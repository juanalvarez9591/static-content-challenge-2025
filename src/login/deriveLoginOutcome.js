export const LoginOutcome = Object.freeze({
  LOGIN_SUCCEEDED: 'LOGIN_SUCCEEDED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  CSRF_REJECTED: 'CSRF_REJECTED',
});

export function deriveLoginOutcome({ csrfValid, userExists, passwordValid, lockedUntil, now }) {
  if (!csrfValid) return { type: LoginOutcome.CSRF_REJECTED };
  if (lockedUntil > now) return { type: LoginOutcome.ACCOUNT_LOCKED };
  if (!userExists || !passwordValid) return { type: LoginOutcome.INVALID_CREDENTIALS };
  return { type: LoginOutcome.LOGIN_SUCCEEDED };
}
