import { describe, expect, it } from 'vitest';
import { AuthOutcome, deriveRequestAuth } from './deriveRequestAuth.js';

const session = { csrf_token: 'token' };
describe('deriveRequestAuth', () => {
  it('denies by default without a session', () => {
    expect(deriveRequestAuth({ session: undefined, method: 'GET' }).type).toBe(AuthOutcome.UNAUTHENTICATED);
  });
  it('lets a GET through with a session, no CSRF header needed', () => {
    expect(deriveRequestAuth({ session, method: 'GET' }).type).toBe(AuthOutcome.AUTHENTICATED);
  });
  it.each(['POST', 'PUT', 'DELETE'])('requires the CSRF token on %s', (method) => {
    expect(deriveRequestAuth({ session, method, csrfHeader: undefined }).type).toBe(AuthOutcome.CSRF_REJECTED);
    expect(deriveRequestAuth({ session, method, csrfHeader: 'wrong' }).type).toBe(AuthOutcome.CSRF_REJECTED);
    expect(deriveRequestAuth({ session, method, csrfHeader: 'token' }).type).toBe(AuthOutcome.AUTHENTICATED);
  });
});
