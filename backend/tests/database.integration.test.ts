import { describe, it } from 'node:test';
import { createDatabase } from '../src/database/client.js';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe('database integration', () => {
  it(
    'connects to PostgreSQL when TEST_DATABASE_URL is provided',
    {
      skip: testDatabaseUrl ? false : 'Set TEST_DATABASE_URL to run the PostgreSQL integration test'
    },
    async () => {
      const database = createDatabase({
        url: testDatabaseUrl ?? '',
        ssl: process.env.TEST_DATABASE_SSL === 'true',
        connectionTimeoutMs: 5000
      });

      try {
        await database.checkConnection();
      } finally {
        await database.close();
      }
    }
  );
});
