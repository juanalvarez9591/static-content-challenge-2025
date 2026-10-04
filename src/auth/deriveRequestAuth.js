import { safeEqual } from './security.js';

export const AuthOutcome = Object.freeze({
  AUTHENTICATED: 'AUTHENTICATED',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  CSRF_REJECTED: 'CSRF_REJECTED',
});

export function deriveRequestAuth({ session, method, csrfHeader }) {
  if (!session) return { type: AuthOutcome.UNAUTHENTICATED };
  if (method !== 'GET' && !safeEqual(csrfHeader, session.csrf_token)) return { type: AuthOutcome.CSRF_REJECTED };
  return { type: AuthOutcome.AUTHENTICATED };
}
