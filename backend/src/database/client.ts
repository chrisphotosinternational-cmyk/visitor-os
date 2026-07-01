import pg from 'pg';
import type { AppConfig } from '../core/config/env.js';

const { Pool } = pg;
type QueryResultRow = pg.QueryResultRow;

export type DatabaseConfig = AppConfig['database'];

export type Database = {
  checkConnection: () => Promise<void>;
  query: <T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[]
  ) => Promise<pg.QueryResult<T>>;
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

    async query<T extends QueryResultRow = QueryResultRow>(
      text: string,
      values?: unknown[]
    ): Promise<pg.QueryResult<T>> {
      return pool.query<T>(text, values);
    },

    async close(): Promise<void> {
      await pool.end();
    }
  };
}
