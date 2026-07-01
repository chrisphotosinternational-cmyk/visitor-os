import { createApp } from './app.js';
import { loadConfig } from './core/config/env.js';
import { createLogger } from './core/logger/logger.js';
import { createDatabase } from './database/client.js';
import { initializeSchema, seedFoundationData } from './database/schema.js';
import { registerShutdownHooks } from './core/lifecycle/shutdown.js';

const logger = createLogger();

async function bootstrap(): Promise<void> {
  const config = loadConfig(process.env);
  const database = createDatabase(config.database);
  const app = await createApp({ config, database, logger });

  await database.checkConnection();
  await initializeSchema(database);
  await seedFoundationData(database);

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
}

bootstrap().catch((error: unknown) => {
  logger.error({ error }, 'Backend failed to start');
  process.exitCode = 1;
});
