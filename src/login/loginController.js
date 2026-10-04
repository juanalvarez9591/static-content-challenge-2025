import { LOGIN_CSRF_COOKIE, SESSION_COOKIE, cookieOptions } from '../auth/cookies.js';
import { newToken, parseCookies, safeEqual, sha256 } from '../auth/security.js';
import { HttpStatus } from '../shared/http/status.js';
import { LoginOutcome, deriveLoginOutcome } from './deriveLoginOutcome.js';

const MAX_FIELD = 1000;
const MAX_USERNAME = 100;
const text = (v, max = MAX_FIELD) => (typeof v === 'string' ? v.slice(0, max) : '');

export const RESPONSE_BY_OUTCOME = {
  [LoginOutcome.LOGIN_SUCCEEDED]: { status: HttpStatus.OK },
  [LoginOutcome.INVALID_CREDENTIALS]: { status: HttpStatus.UNAUTHORIZED, error: 'invalid_credentials' },
  [LoginOutcome.ACCOUNT_LOCKED]: { status: HttpStatus.TOO_MANY_REQUESTS, error: 'too_many_attempts' },
  [LoginOutcome.CSRF_REJECTED]: { status: HttpStatus.FORBIDDEN, error: 'csrf' },
};

export function makeLoginController({ users, sessions, attempts, passwordHasher, config }) {
  const options = cookieOptions(config);
  const now = () => config.now();
  let hashVerifiedWhenUserIsUnknown;

  return {
    issueToken(req, res) {
      const csrf = newToken();
      res.cookie(LOGIN_CSRF_COOKIE, csrf, options);
      res.json({ csrf });
    },

    async login(req, res) {
      const event = res.locals.event;
      const body = req.body ?? {};
      const username = text(body.username, MAX_USERNAME);
      const csrfValid = safeEqual(text(body._csrf), parseCookies(req.headers.cookie)[LOGIN_CSRF_COOKIE]);

      const user = csrfValid ? users.findByUsername(username) : undefined;
      let passwordValid = false;
      if (csrfValid) {
        hashVerifiedWhenUserIsUnknown ??= await passwordHasher.hash('dummy-password');
        const matches = await passwordHasher.verify(user?.password_hash ?? hashVerifiedWhenUserIsUnknown, text(body.password));
        passwordValid = Boolean(user) && matches;
      }
      const outcome = deriveLoginOutcome({
        csrfValid, userExists: Boolean(user), passwordValid, lockedUntil: attempts.lockedUntil(username), now: now(),
      });
      event.auth_outcome = outcome.type;

      if (outcome.type === LoginOutcome.INVALID_CREDENTIALS) {
        attempts.recordFailure(username, { now: now(), maxAttempts: config.maxFailedAttempts, lockMs: config.lockMs });
      }
      if (outcome.type !== LoginOutcome.LOGIN_SUCCEEDED) {
        const { status, error } = RESPONSE_BY_OUTCOME[outcome.type];
        return res.status(status).json({ error });
      }

      attempts.clear(username);
      const sid = newToken();
      const csrf = newToken();
      sessions.create({ idHash: sha256(sid), userId: user.id, csrfToken: csrf, expiresAt: now() + config.sessionTtlMs });
      event.user_id = user.id;
      res.clearCookie(LOGIN_CSRF_COOKIE, options);
      res.cookie(SESSION_COOKIE, sid, { ...options, maxAge: config.sessionTtlMs });
      return res.status(RESPONSE_BY_OUTCOME[outcome.type].status).json({ csrf });
    },

    me: (req, res) => res.json({ csrf: req.session.csrf }),

    logout(req, res) {
      sessions.delete(req.session.idHash);
      res.clearCookie(SESSION_COOKIE, options);
      res.status(HttpStatus.NO_CONTENT).end();
    },
  };
}

