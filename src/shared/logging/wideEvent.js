import { randomUUID } from 'node:crypto';
import { HttpStatus } from '../http/status.js';

export function levelFor(event) {
  if (event.status >= HttpStatus.INTERNAL_SERVER_ERROR || event.err) return 'error';
  if (event.outcome === 'INVALID_PATH' || event.auth_outcome === 'INVALID_CREDENTIALS'
    || event.auth_outcome === 'ACCOUNT_LOCKED' || event.status === HttpStatus.TOO_MANY_REQUESTS) return 'warn';
  return 'info';
}

export function wideEvents(logger) {
  return (req, res, next) => {
    const start = process.hrtime.bigint();
    const request_id = randomUUID();
    const event = { request_id, method: req.method, url: req.originalUrl };
    res.locals.event = event;
    res.setHeader('X-Request-Id', request_id);

    res.on('finish', () => {
      event.status = res.statusCode;
      event.duration_ms = Number(process.hrtime.bigint() - start) / 1e6;
      event.response_bytes = Number(res.getHeader('content-length')) || undefined;
      event.user_agent = req.get('user-agent');
      event.ip = req.ip;
      const level = event.skip_log ? 'debug' : levelFor(event);
      delete event.skip_log;
      logger[level](event, event.err ? 'request_failed' : 'request_completed');
    });
    next();
  };
}
