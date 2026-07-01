import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';
import { registerErrorHandler } from './core/errors/error-handler.js';
import type { AppConfig } from './core/config/env.js';
import type { AppLogger } from './core/logger/logger.js';
import type { Database } from './database/client.js';

export type AppDependencies = {
  config: AppConfig;
  database: Database;
  logger: AppLogger;
};

export async function createApp(dependencies: AppDependencies): Promise<FastifyInstance> {
  const app = Fastify({
    loggerInstance: dependencies.logger
  });

  await app.register(cors, {
    origin: dependencies.config.security.allowedOrigins
  });

  registerErrorHandler(app);

  app.get('/health', () => ({
    status: 'ok',
    app: dependencies.config.app.name,
    environment: dependencies.config.app.environment
  }));

  return app;
}
