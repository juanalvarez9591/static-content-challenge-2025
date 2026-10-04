import pino from 'pino';

export function createLogger({ level = process.env.LOG_LEVEL, destination } = {}) {
  const defaultLevel = process.env.NODE_ENV === 'production' ? 'info' : 'debug';
  return pino({
    level: level ?? defaultLevel, base: { app_version: process.env.APP_VERSION ?? 'dev' },
    serializers: { err: (e) => e },
  }, destination);
}
