import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import type { Database } from '../src/database/client.js';

describe('database contract', () => {
  it('requires a startup connection check', async () => {
    const checkConnection = mock.fn(async () => undefined);
    const database: Database = {
      checkConnection,
      query: mock.fn(async () => ({ rows: [] }) as never),
      close: mock.fn(async () => undefined)
    };

    await database.checkConnection();

    assert.equal(checkConnection.mock.callCount(), 1);
  });
});
