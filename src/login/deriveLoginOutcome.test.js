import { describe, expect, it } from 'vitest';
import { LoginOutcome, deriveLoginOutcome } from './deriveLoginOutcome.js';

describe('deriveLoginOutcome', () => {
  const base = { csrfValid: true, userExists: true, passwordValid: true, lockedUntil: 0, now: 1000 };
  it('succeeds with valid credentials', () => expect(deriveLoginOutcome(base).type).toBe(LoginOutcome.LOGIN_SUCCEEDED));
  it('same outcome for unknown user and wrong password', () => {
    expect(deriveLoginOutcome({ ...base, userExists: false, passwordValid: false })).toEqual(
      deriveLoginOutcome({ ...base, passwordValid: false }));
  });
  it('a locked account stays locked even with the right password', () => {
    expect(deriveLoginOutcome({ ...base, lockedUntil: 2000 }).type).toBe(LoginOutcome.ACCOUNT_LOCKED);
  });
  it('lock expires', () => expect(deriveLoginOutcome({ ...base, lockedUntil: 1000 }).type).toBe(LoginOutcome.LOGIN_SUCCEEDED));
  it('a bad CSRF token is rejected before anything else', () => {
    expect(deriveLoginOutcome({ ...base, csrfValid: false, lockedUntil: 2000 }).type).toBe(LoginOutcome.CSRF_REJECTED);
  });
});
