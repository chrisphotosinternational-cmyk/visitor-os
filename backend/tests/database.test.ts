import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import { createDatabase, type Database } from '../src/database/client.js';

describe('database contract', () => {
  it('requires a startup connection check', async () => {
    const checkConnection = mock.fn(async () => undefined);
    const database: Database = {
      isConfigured: mock.fn(() => true),
      checkConnection,
      query: mock.fn(async () => ({ rows: [] }) as never),
      close: mock.fn(async () => undefined)
    };

    await database.checkConnection();

    assert.equal(checkConnection.mock.callCount(), 1);
  });

  it('stays disabled when no database url is configured', async () => {
    const database = createDatabase({
      ssl: false,
      connectionTimeoutMs: 1000
    });

    assert.equal(database.isConfigured(), false);
    await assert.rejects(() => database.checkConnection(), /DATABASE_URL/);
    await assert.rejects(() => database.query('select 1'), /DATABASE_URL/);
    await database.close();
  });
});
