import express from 'express';
import { makeRequireSession } from '../auth/requireSession.js';
import { passwordHasher as defaultHasher } from '../auth/security.js';
import { makeLoginController } from '../login/loginController.js';
import { MAX_MARKDOWN_BYTES, makeManagePagesController } from '../manage-pages/managePagesController.js';
import { makeUploadImageController } from '../upload-image/uploadImageController.js';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

export function makeAdminApi({
  users, sessions, attempts, repo, uploads, config, passwordHasher = defaultHasher, loginLimiter,
}) {
  const router = express.Router();
  const login = makeLoginController({ users, sessions, attempts, passwordHasher, config });
  const pages = makeManagePagesController({ repo });
  const uploadImage = makeUploadImageController({ uploads });
  const json = express.json({ limit: `${MAX_MARKDOWN_BYTES + 4096}b` });

  router.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  router.get('/login-token', login.issueToken);
  router.post('/login', loginLimiter, express.json({ limit: '10kb' }), login.login);

  router.use(makeRequireSession({ sessions, config }));
  router.get('/me', login.me);
  router.post('/logout', login.logout);

  router.get('/pages', pages.list);
  router.get('/pages/content', pages.read);
  router.post('/pages', json, pages.create);
  router.put('/pages', json, pages.update);
  router.delete('/pages', pages.remove);

  router.post('/images', express.raw({ type: IMAGE_TYPES, limit: MAX_IMAGE_BYTES }), uploadImage);

  return router;
}
