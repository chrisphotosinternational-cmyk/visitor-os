import pg from 'pg';
import type { AppConfig } from '../core/config/env.js';

const { Pool } = pg;

export type DatabaseConfig = AppConfig['database'];

export type Database = {
  checkConnection: () => Promise<void>;
  close: () => Promise<void>;
};

export function createDatabase(config: DatabaseConfig): Database {
  const pool = new Pool({
    connectionString: config.url,
    connectionTimeoutMillis: config.connectionTimeoutMs,
    ssl: config.ssl ? { rejectUnauthorized: false } : false
  });

  return {
    async checkConnection(): Promise<void> {
      const client = await pool.connect();

      try {
        await client.query('select 1');
      } finally {
        client.release();
      }
    },

    async close(): Promise<void> {
      await pool.end();
    }
  };
}
