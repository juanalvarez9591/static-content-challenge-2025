import { describe, expect, it } from 'vitest';
import { HttpStatus } from '../shared/http/status.js';
import { makeLoginController } from './loginController.js';

const config = { now: () => 1000, maxFailedAttempts: 2, lockMs: 500, sessionTtlMs: 10_000, secureCookies: false };
const hasher = { hash: async (p) => `h:${p}`, verify: async (hash, p) => hash === `h:${p}` };

function setup({ lockedUntil = 0 } = {}) {
  const calls = { failures: [], sessions: [], cleared: [] };
  const controller = makeLoginController({
    users: { findByUsername: (u) => (u === 'admin' ? { id: 7, password_hash: 'h:secret' } : undefined) },
    sessions: { create: (s) => calls.sessions.push(s), delete: () => {} },
    attempts: {
      lockedUntil: () => lockedUntil,
      recordFailure: (u) => calls.failures.push(u),
      clear: (u) => calls.cleared.push(u),
    },
    passwordHasher: hasher, config,
  });
  return { controller, calls };
}
async function login(controller, body, cookie = 'login_csrf=tok') {
  const res = {
    locals: { event: {} }, cookies: {},
    status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; },
    cookie(n, v) { this.cookies[n] = v; }, clearCookie() {},
  };
  await controller.login({ body, headers: { cookie } }, res);
  return res;
}

describe('loginController', () => {
  it('success: 200, new session, cookie, failures cleared', async () => {
    const { controller, calls } = setup();
    const res = await login(controller, { username: 'admin', password: 'secret', _csrf: 'tok' });
    expect(res.code).toBe(HttpStatus.OK);
    expect(calls.sessions).toHaveLength(1);
    expect(res.cookies.sid).toBeTruthy();
    expect(calls.cleared).toEqual(['admin']);
    expect(res.locals.event).toMatchObject({ auth_outcome: 'LOGIN_SUCCEEDED', user_id: 7 });
  });
  it('wrong password and unknown user both 401 and record a failure', async () => {
    const { controller, calls } = setup();
    const a = await login(controller, { username: 'admin', password: 'nope', _csrf: 'tok' });
    const b = await login(controller, { username: 'ghost', password: 'x', _csrf: 'tok' });
    expect([a.code, b.code]).toEqual([HttpStatus.UNAUTHORIZED, HttpStatus.UNAUTHORIZED]);
    expect(a.body).toEqual(b.body);
    expect(calls.failures).toEqual(['admin', 'ghost']);
    expect(calls.sessions).toHaveLength(0);
  });
  it('locked: 429 even with the right password, and no session', async () => {
    const { controller, calls } = setup({ lockedUntil: 5000 });
    const res = await login(controller, { username: 'admin', password: 'secret', _csrf: 'tok' });
    expect(res.code).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect(calls.sessions).toHaveLength(0);
  });
  it('bad CSRF: 403, nothing recorded', async () => {
    const { controller, calls } = setup();
    const res = await login(controller, { username: 'admin', password: 'secret', _csrf: 'other' });
    expect(res.code).toBe(HttpStatus.FORBIDDEN);
    expect(calls.failures).toEqual([]);
  });
});
