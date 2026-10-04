import fs from 'node:fs/promises';
import path from 'node:path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HttpStatus } from '../../src/shared/http/status.js';
import { makeTestApp } from './helpers.js';

const PASSWORD = 'correct horse battery';
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32, 1)]);

let t;
let clock;
beforeEach(async () => {
  clock = { now: 1_000_000 };
  t = await makeTestApp({ config: { now: () => clock.now, maxFailedAttempts: 3, lockMs: 60_000 } });
  await t.addAdmin('admin', PASSWORD);
});
afterEach(() => t.cleanup());

async function login(agent, username = 'admin', password = PASSWORD) {
  const { body } = await agent.get('/api/admin/login-token');
  return agent.post('/api/admin/login').send({ _csrf: body.csrf, username, password });
}
async function loggedIn() {
  const agent = request.agent(t.app);
  const res = await login(agent);
  expect(res.status).toBe(HttpStatus.OK);
  return { agent, csrf: res.body.csrf };
}
const post = (a, url, csrf) => a.post(url).set('X-CSRF-Token', csrf);

describe('admin API access control', () => {
  it.each([
    ['get', '/api/admin/me'], ['get', '/api/admin/pages'], ['post', '/api/admin/pages'],
    ['put', '/api/admin/pages'], ['delete', '/api/admin/pages?path=x'], ['post', '/api/admin/images'],
    ['post', '/api/admin/logout'],
  ])('rejects unauthenticated %s %s with 401', async (method, url) => {
    expect((await request(t.app)[method](url)).status).toBe(HttpStatus.UNAUTHORIZED);
  });
  it('rejects a tampered session cookie', async () => {
    const res = await request(t.app).get('/api/admin/me').set('Cookie', 'sid=forged-value');
    expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
  });
  it('rejects an expired session', async () => {
    const { agent } = await loggedIn();
    clock.now += 9 * 60 * 60 * 1000;
    expect((await agent.get('/api/admin/me')).status).toBe(HttpStatus.UNAUTHORIZED);
  });
  it('sets HttpOnly + SameSite=Strict cookies scoped to the API and never caches', async () => {
    const res = await login(request.agent(t.app));
    const cookie = res.headers['set-cookie'].find((c) => c.startsWith('sid='));
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Strict/);
    expect(cookie).toMatch(/Path=\/api\/admin/);
    expect(res.headers['cache-control']).toBe('no-store');
  });
  it('issues a new session id on every login (rotation)', async () => {
    const sid = async () => (await login(request.agent(t.app))).headers['set-cookie'].find((c) => c.startsWith('sid='));
    expect(await sid()).not.toBe(await sid());
  });
  it('reports the session with /me', async () => {
    const { agent, csrf } = await loggedIn();
    expect((await agent.get('/api/admin/me')).body).toEqual({ csrf });
  });
  it('serves the admin shell for any /admin URL (client-side routing)', async () => {
    for (const url of ['/admin', '/admin/login', '/admin/pages/new']) {
      const res = await request(t.app).get(url);
      expect(res.status).toBe(HttpStatus.OK);
      expect(res.text).toContain('<div id="root"></div>');
    }
  });
});

describe('admin login', () => {
  it('gives the same answer for unknown user and wrong password', async () => {
    const a = await login(request.agent(t.app), 'nobody', 'whatever');
    const b = await login(request.agent(t.app), 'admin', 'wrong');
    expect(a.status).toBe(HttpStatus.UNAUTHORIZED);
    expect(b.status).toBe(HttpStatus.UNAUTHORIZED);
    expect(a.body).toEqual(b.body);
  });
  it('locks the account after repeated failures, even for the right password, then unlocks', async () => {
    for (let i = 0; i < 3; i++) await login(request.agent(t.app), 'admin', 'wrong');
    expect((await login(request.agent(t.app))).status).toBe(HttpStatus.TOO_MANY_REQUESTS);
    clock.now += 61_000;
    expect((await login(request.agent(t.app))).status).toBe(HttpStatus.OK);
  });
  it('locks unknown usernames the same way (no user enumeration)', async () => {
    for (let i = 0; i < 3; i++) await login(request.agent(t.app), 'ghost', 'x');
    expect((await login(request.agent(t.app), 'ghost', 'x')).status).toBe(HttpStatus.TOO_MANY_REQUESTS);
  });
  it('rejects a login without a matching CSRF token', async () => {
    const agent = request.agent(t.app);
    await agent.get('/api/admin/login-token');
    const res = await agent.post('/api/admin/login').send({ _csrf: 'nope', username: 'admin', password: PASSWORD });
    expect(res.status).toBe(HttpStatus.FORBIDDEN);
  });
  it('rate limits login attempts per IP with 429', async () => {
    const limited = await makeTestApp({ config: { loginRateLimit: 2 } });
    const agent = request.agent(limited.app);
    const statuses = [];
    for (let i = 0; i < 4; i++) statuses.push((await agent.post('/api/admin/login').send({})).status);
    expect(statuses.at(-1)).toBe(HttpStatus.TOO_MANY_REQUESTS);
    await limited.cleanup();
  });
  it('logs failures as warnings and never logs the password or session token', async () => {
    await login(request.agent(t.app), 'admin', 'super-secret-wrong');
    const { agent } = await loggedIn();
    await agent.get('/api/admin/me');
    const raw = JSON.stringify(t.logs);
    expect(raw).not.toContain('super-secret-wrong');
    expect(raw).not.toContain(PASSWORD);
    expect(raw).not.toMatch(/sid=/);
    expect(t.logs.find((l) => l.auth_outcome === 'INVALID_CREDENTIALS')).toMatchObject({ level: 40 });
  });
  it('logs out and invalidates the session', async () => {
    const { agent, csrf } = await loggedIn();
    expect((await post(agent, '/api/admin/logout', csrf)).status).toBe(HttpStatus.NO_CONTENT);
    expect((await agent.get('/api/admin/me')).status).toBe(HttpStatus.UNAUTHORIZED);
  });
});

describe('admin page management', () => {
  it('creates, edits and deletes a page that is served immediately', async () => {
    const { agent, csrf } = await loggedIn();
    let res = await post(agent, '/api/admin/pages', csrf).send({ path: 'blog/july/news', markdown: '# July' });
    expect(res.status).toBe(HttpStatus.CREATED);
    expect((await request(t.app).get('/blog/july/news')).text).toContain('<h1>July</h1>');
    expect((await agent.get('/api/admin/pages')).body.pages).toContain('blog/july/news');

    res = await agent.put('/api/admin/pages').set('X-CSRF-Token', csrf).send({ path: 'blog/july/news', markdown: '# Edited' });
    expect(res.status).toBe(HttpStatus.OK);
    expect((await request(t.app).get('/api/content?path=/blog/july/news')).body.html).toContain('Edited');
    expect((await agent.get('/api/admin/pages/content?path=blog/july/news')).body.markdown).toBe('# Edited');

    res = await agent.delete('/api/admin/pages?path=blog/july/news').set('X-CSRF-Token', csrf);
    expect(res.status).toBe(HttpStatus.NO_CONTENT);
    expect((await request(t.app).get('/blog/july/news')).status).toBe(HttpStatus.NOT_FOUND);
    await expect(fs.access(path.join(t.contentDir, 'blog'))).rejects.toThrow();
  });
  it('rejects state-changing requests without a valid CSRF token', async () => {
    const { agent } = await loggedIn();
    expect((await agent.post('/api/admin/pages').send({ path: 'x', markdown: 'y' })).status).toBe(HttpStatus.FORBIDDEN);
    expect((await post(agent, '/api/admin/pages', 'bad').send({ path: 'x' })).status).toBe(HttpStatus.FORBIDDEN);
    expect((await request(t.app).get('/x')).status).toBe(HttpStatus.NOT_FOUND);
  });
  it.each(['../evil', 'a/../../evil', 'a\\b', 'UPPER', '%2e%2e/evil'])('refuses to write to path %j', async (p) => {
    const { agent, csrf } = await loggedIn();
    const res = await post(agent, '/api/admin/pages', csrf).send({ path: p, markdown: 'pwned' });
    expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    await expect(fs.access(path.join(t.dir, 'evil'))).rejects.toThrow();
  });
  it('refuses to write through a symlink that leaves content', async () => {
    const outside = path.join(t.dir, 'outside');
    await fs.mkdir(outside);
    await fs.symlink(outside, path.join(t.contentDir, 'link'));
    const { agent, csrf } = await loggedIn();
    const res = await post(agent, '/api/admin/pages', csrf).send({ path: 'link/page', markdown: 'pwned' });
    expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    expect(await fs.readdir(outside)).toEqual([]);
  });
  it('returns 409 when creating an existing page and 404 when editing a missing one', async () => {
    await t.write('exists/index.md', '# x');
    const { agent, csrf } = await loggedIn();
    expect((await post(agent, '/api/admin/pages', csrf).send({ path: 'exists', markdown: 'y' })).status).toBe(HttpStatus.CONFLICT);
    const res = await agent.put('/api/admin/pages').set('X-CSRF-Token', csrf).send({ path: 'missing', markdown: 'y' });
    expect(res.status).toBe(HttpStatus.NOT_FOUND);
  });
});

describe('admin image upload', () => {
  const upload = (agent, csrf, body, type = 'image/png') =>
    post(agent, '/api/admin/images', csrf).set('Content-Type', type).send(body);

  it('stores a pasted image and serves it from /uploads', async () => {
    const { agent, csrf } = await loggedIn();
    const res = await upload(agent, csrf, PNG);
    expect(res.status).toBe(HttpStatus.CREATED);
    expect(res.body.url).toMatch(/^\/uploads\/[0-9a-f]{32}\.png$/);
    const served = await request(t.app).get(res.body.url);
    expect(served.status).toBe(HttpStatus.OK);
    expect(served.headers['content-type']).toBe('image/png');
    expect(served.body.equals(PNG)).toBe(true);
    expect(served.headers['x-content-type-options']).toBe('nosniff');
  });
  it('deduplicates identical uploads', async () => {
    const { agent, csrf } = await loggedIn();
    const a = await upload(agent, csrf, PNG);
    const b = await upload(agent, csrf, PNG);
    expect(a.body.url).toBe(b.body.url);
  });
  it('rejects content that is not really an image, whatever the declared type', async () => {
    const { agent, csrf } = await loggedIn();
    const res = await upload(agent, csrf, Buffer.from('<script>alert(1)</script>'.padEnd(40, ' ')));
    expect(res.status).toBe(HttpStatus.UNSUPPORTED_MEDIA_TYPE);
  });
  it('rejects SVG and other declared types', async () => {
    const { agent, csrf } = await loggedIn();
    expect((await upload(agent, csrf, '<svg xmlns="http://www.w3.org/2000/svg"/>', 'image/svg+xml')).status)
      .toBe(HttpStatus.UNSUPPORTED_MEDIA_TYPE);
  });
  it('rejects images over 5 MB', async () => {
    const { agent, csrf } = await loggedIn();
    const big = Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)]);
    expect((await upload(agent, csrf, big)).status).toBe(HttpStatus.PAYLOAD_TOO_LARGE);
  });
  it('requires a session and a CSRF token', async () => {
    const { agent } = await loggedIn();
    expect((await agent.post('/api/admin/images').set('Content-Type', 'image/png').send(PNG)).status)
      .toBe(HttpStatus.FORBIDDEN);
    expect((await request(t.app).post('/api/admin/images').set('Content-Type', 'image/png').send(PNG)).status)
      .toBe(HttpStatus.UNAUTHORIZED);
  });
  it('does not serve dotfiles or directory listings from /uploads', async () => {
    expect((await request(t.app).get('/uploads/')).status).toBe(HttpStatus.NOT_FOUND);
    expect((await request(t.app).get('/uploads/..%2f..%2fpackage.json')).status).not.toBe(HttpStatus.OK);
  });
});
