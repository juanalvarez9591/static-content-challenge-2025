import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../../src/app.js';
import { createLogger } from '../../src/shared/logging/logger.js';
import { makeUserRepository } from '../../src/auth/db.js';
import { passwordHasher } from '../../src/auth/security.js';

export async function makeTestApp({ config = {}, template = '<html><body>{{content}}</body></html>' } = {}) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'acme-'));
  const contentDir = path.join(dir, 'content');
  await fs.mkdir(contentDir);
  const templatePath = path.join(dir, 'template.html');
  if (template !== null) await fs.writeFile(templatePath, template);

  const lines = [];
  const logger = createLogger({ level: 'debug', destination: { write: (l) => lines.push(JSON.parse(l)) } });
  const app = createApp({
    contentDir, templatePath, dbPath: ':memory:', logger, uploadsDir: path.join(dir, 'uploads'),
    config: { globalRateLimit: 10000, loginRateLimit: 10000, ...config },
  });
  return {
    app, dir, contentDir, logs: lines,
    write: async (rel, text) => {
      await fs.mkdir(path.dirname(path.join(contentDir, rel)), { recursive: true });
      await fs.writeFile(path.join(contentDir, rel), text);
    },
    addAdmin: async (username = 'admin', password = 'correct horse battery') =>
      makeUserRepository(app.locals.db).create(username, await passwordHasher.hash(password)),
    cleanup: () => fs.rm(dir, { recursive: true, force: true }),
  };
}
