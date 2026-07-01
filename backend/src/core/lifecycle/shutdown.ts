import type { FastifyInstance } from 'fastify';
import type { AppLogger } from '../logger/logger.js';
import type { Database } from '../../database/client.js';

type ShutdownDependencies = {
  app: FastifyInstance;
  database: Database;
  logger: AppLogger;
  shutdownTimeoutMs: number;
};

export function registerShutdownHooks(dependencies: ShutdownDependencies): void {
  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    dependencies.logger.info({ signal }, 'Shutdown requested');

    const timeout = setTimeout(() => {
      dependencies.logger.error({ signal }, 'Shutdown timeout reached');
      process.exit(1);
    }, dependencies.shutdownTimeoutMs);

    try {
      await dependencies.app.close();
      await dependencies.database.close();
      clearTimeout(timeout);
      dependencies.logger.info({ signal }, 'Shutdown completed');
      process.exit(0);
    } catch (error) {
      clearTimeout(timeout);
      dependencies.logger.error({ error }, 'Shutdown failed');
      process.exit(1);
    }
  };

  process.once('SIGTERM', () => {
    void shutdown('SIGTERM');
  });

  process.once('SIGINT', () => {
    void shutdown('SIGINT');
  });
}
