import { createApp } from './app.js';
import { loadConfig } from './core/config/env.js';
import { createLogger } from './core/logger/logger.js';
import { createDatabase } from './database/client.js';
import { initializeSchema, seedFoundationData } from './database/schema.js';
import { registerShutdownHooks } from './core/lifecycle/shutdown.js';
import { seedFirstAdmin } from './modules/auth/bootstrap.js';

const logger = createLogger();

type ReadinessState = {
  database: 'disabled' | 'pending' | 'ok' | 'error';
};

async function bootstrap(): Promise<void> {
  const config = loadConfig(process.env);
  const database = createDatabase(config.database);
  const readiness: ReadinessState = {
    database: database.isConfigured() ? 'pending' : 'disabled'
  };
  const app = await createApp({ config, database, logger, readiness });

  registerShutdownHooks({
    app,
    database,
    logger,
    shutdownTimeoutMs: config.server.shutdownTimeoutMs
  });

  await app.listen({
    host: config.server.host,
    port: config.server.port
  });

  logger.info(
    {
      host: config.server.host,
      port: config.server.port
    },
    'Backend listening'
  );

  if (!database.isConfigured()) {
    logger.warn('DATABASE_URL is not configured; database-backed routes are unavailable');
    return;
  }

  initializeRuntime(database, config, readiness).catch((error: unknown) => {
    readiness.database = 'error';
    logger.error({ error }, 'Backend initialization failed after server start');
  });
}

async function initializeRuntime(
  database: ReturnType<typeof createDatabase>,
  config: ReturnType<typeof loadConfig>,
  readiness: ReadinessState
): Promise<void> {
  await database.checkConnection();
  await initializeSchema(database);
  await seedFoundationData(database);
  await seedFirstAdmin(database, config);
  readiness.database = 'ok';
  logger.info('Backend initialization completed');
}

bootstrap().catch((error: unknown) => {
  logger.error({ error }, 'Backend failed to start');
  process.exitCode = 1;
});
