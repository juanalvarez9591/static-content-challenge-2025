import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { marked } from 'marked';
import { makeAdminApi } from './admin/adminApi.js';
import { makeLoginAttemptRepository, makeSessionRepository, makeUserRepository, openDb } from './auth/db.js';
import { makePageRepository } from './page/pageRepository.js';
import { serializeError } from './shared/errors.js';
import { HttpStatus } from './shared/http/status.js';
import { createLogger } from './shared/logging/logger.js';
import { wideEvents } from './shared/logging/wideEvent.js';
import { makeTemplateRepository } from './template/templateRepository.js';
import { renderPage } from './serve-page/renderPage.js';
import { renderAdminShell, renderShell } from './serve-page/renderShell.js';
import { makeLoadPage, makeServeContentApi, makeServePage } from './serve-page/serveController.js';
import { makeUploadsRepository } from './upload-image/uploadsRepository.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const MINUTE_MS = 60 * 1000;
const DEFAULT_PROXY_HOPS = 1;

const defaultConfig = {
  secureCookies: process.env.NODE_ENV === 'production',
  sessionTtlMs: 8 * 60 * MINUTE_MS,
  maxFailedAttempts: 5,
  lockMs: 15 * MINUTE_MS,
  globalRateLimit: 300,
  loginRateLimit: 10,
  now: () => Date.now(),
};

export function createApp({
  contentDir = process.env.CONTENT_DIR ?? path.join(here, 'content'),
  templatePath = path.join(here, 'template.html'),
  publicDir = path.join(here, '..', 'public'),
  clientDir = path.join(here, '..', 'dist', 'client'),
  uploadsDir = process.env.UPLOADS_DIR ?? 'data/uploads',
  dbPath = process.env.DB_PATH ?? 'data/app.sqlite',
  logger = createLogger(),
  config: configOverrides = {},
  passwordHasher,
} = {}) {
  const config = { ...defaultConfig, ...configOverrides };
  const app = express();
  app.set('trust proxy', Number(process.env.TRUST_PROXY ?? DEFAULT_PROXY_HOPS));
  app.disable('x-powered-by');

  app.use(wideEvents(logger));
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'"], imgSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"], frameAncestors: ["'none'"], formAction: ["'self'"], upgradeInsecureRequests: null,
      },
    },
  }));
  app.use(rateLimit({ windowMs: MINUTE_MS, limit: config.globalRateLimit, standardHeaders: true, legacyHeaders: false }));

  app.get('/healthz', (req, res) => {
    res.locals.event.skip_log = true;
    res.json({ status: 'ok' });
  });
  app.use(express.static(publicDir, { dotfiles: 'ignore' }));
  app.use(express.static(clientDir, { dotfiles: 'ignore' }));
  const uploads = makeUploadsRepository(uploadsDir);
  app.use('/uploads', express.static(uploads.dir, { dotfiles: 'ignore', index: false }));

  const repo = makePageRepository(contentDir);
  const db = openDb(dbPath);
  const loginLimiter = rateLimit({
    windowMs: 15 * MINUTE_MS, limit: config.loginRateLimit, standardHeaders: true, legacyHeaders: false,
    handler: (req, res) => {
      res.locals.event.auth_outcome = 'RATE_LIMITED';
      res.status(HttpStatus.TOO_MANY_REQUESTS).json({ error: 'too_many_requests' });
    },
  });
  app.use('/api/admin', makeAdminApi({
    users: makeUserRepository(db), sessions: makeSessionRepository(db), attempts: makeLoginAttemptRepository(db),
    repo, uploads, config, passwordHasher, loginLimiter,
  }));

  const templates = makeTemplateRepository(templatePath);
  const loadPage = makeLoadPage({ repo, renderMarkdown: (md) => marked.parse(md) });
  app.get('/api/content', makeServeContentApi({ loadPage }));

  const serveAdminShell = async (req, res) => {
    res.type('html').send(renderPage((await templates.get()).source, renderAdminShell()));
  };
  app.get('/admin', serveAdminShell);
  app.get('/admin/{*splat}', serveAdminShell);

  app.get('/{*splat}', makeServePage({ loadPage, templates, renderPage, renderShell }));

  app.use((err, req, res, next) => {
    const status = err.status >= HttpStatus.BAD_REQUEST && err.status < HttpStatus.INTERNAL_SERVER_ERROR
      ? err.status : HttpStatus.INTERNAL_SERVER_ERROR;
    if (status === HttpStatus.INTERNAL_SERVER_ERROR) res.locals.event.err = serializeError(err);
    if (res.headersSent) return next(err);
    if (req.path.startsWith('/api/')) {
      return res.status(status).json({ error: status === HttpStatus.INTERNAL_SERVER_ERROR ? 'internal_error' : 'bad_request' });
    }
    res.status(status).type('html').send(status === HttpStatus.INTERNAL_SERVER_ERROR
      ? '<h1>Something went wrong</h1>' : '<h1>Bad request</h1>');
  });

  app.locals.db = db;
  return app;
}
