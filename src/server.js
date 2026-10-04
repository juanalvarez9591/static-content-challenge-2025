import { createApp } from './app.js';
import { createLogger } from './shared/logging/logger.js';
import { serializeError } from './shared/errors.js';

const logger = createLogger();
const port = Number(process.env.PORT) || 3000;

for (const name of ['unhandledRejection', 'uncaughtException']) {
  process.on(name, (err) => {
    logger.fatal({ err: serializeError(err) }, name);
    logger.flush?.();
    process.exit(1);
  });
}

createApp({ logger }).listen(port, () => logger.info({ port }, 'server_started'));
