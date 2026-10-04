import { HttpStatus } from '../shared/http/status.js';
import { SESSION_COOKIE } from './cookies.js';
import { AuthOutcome, deriveRequestAuth } from './deriveRequestAuth.js';
import { parseCookies, sha256 } from './security.js';

const RESPONSE_BY_OUTCOME = {
  [AuthOutcome.UNAUTHENTICATED]: { status: HttpStatus.UNAUTHORIZED, error: 'unauthenticated', auth_outcome: 'NO_SESSION' },
  [AuthOutcome.CSRF_REJECTED]: { status: HttpStatus.FORBIDDEN, error: 'csrf', auth_outcome: 'CSRF_REJECTED' },
};

export function makeRequireSession({ sessions, config }) {
  return function requireSession(req, res, next) {
    const sid = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    const session = sid ? sessions.findValid(sha256(sid), config.now()) : undefined;
    const outcome = deriveRequestAuth({ session, method: req.method, csrfHeader: req.get('x-csrf-token') });

    if (outcome.type !== AuthOutcome.AUTHENTICATED) {
      const { status, error, auth_outcome } = RESPONSE_BY_OUTCOME[outcome.type];
      res.locals.event.auth_outcome = auth_outcome;
      if (session) res.locals.event.user_id = session.user_id;
      return res.status(status).json({ error });
    }
    req.session = { idHash: sha256(sid), userId: session.user_id, csrf: session.csrf_token };
    res.locals.event.user_id = session.user_id;
    return next();
  };
}
