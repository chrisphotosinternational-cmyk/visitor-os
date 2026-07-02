import pg from 'pg';
import type { AppConfig } from '../core/config/env.js';

const { Pool } = pg;
type QueryResultRow = pg.QueryResultRow;

export type DatabaseConfig = AppConfig['database'];

export type Database = {
  isConfigured: () => boolean;
  checkConnection: () => Promise<void>;
  query: <T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[]
  ) => Promise<pg.QueryResult<T>>;
  close: () => Promise<void>;
};

export function createDatabase(config: DatabaseConfig): Database {
  if (!config.url) {
    return createUnavailableDatabase();
  }

  const pool = new Pool({
    connectionString: config.url,
    connectionTimeoutMillis: config.connectionTimeoutMs,
    ssl: config.ssl ? { rejectUnauthorized: false } : false
  });

  return {
    isConfigured(): boolean {
      return true;
    },

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

function createUnavailableDatabase(): Database {
  return {
    isConfigured(): boolean {
      return false;
    },

    checkConnection(): Promise<void> {
      return Promise.reject(new Error('DATABASE_URL is not configured'));
    },

    query<T extends QueryResultRow = QueryResultRow>(): Promise<pg.QueryResult<T>> {
      return Promise.reject(new Error('DATABASE_URL is not configured'));
    },

    close(): Promise<void> {
      return Promise.resolve();
    }
  };
}
