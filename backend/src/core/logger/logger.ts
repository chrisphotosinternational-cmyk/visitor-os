import Fastify, { type FastifyBaseLogger } from 'fastify';

export type AppLogger = FastifyBaseLogger;

export function createLogger(): AppLogger {
  const level = process.env.LOG_LEVEL ?? 'info';
  const app = Fastify({
    logger: {
      level
    }
  });

  return app.log;
}
