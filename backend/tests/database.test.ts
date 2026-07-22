import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it, mock } from 'node:test';
import { createDatabase, type Database } from '../src/database/client.js';
import { initializeSchema } from '../src/database/schema.js';

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

  it('keeps reasoning trace quality score columns additive in startup schema and migrations', async () => {
    let startupSchemaSql = '';
    const database: Database = {
      isConfigured: mock.fn(() => true),
      checkConnection: mock.fn(async () => undefined),
      close: mock.fn(async () => undefined),
      query: mock.fn(async (text: string) => {
        startupSchemaSql += text;
        return { rows: [] } as never;
      })
    };
    const migrationSql = await readFile(
      'prisma/migrations/202607084_reasoning_trace_quality_scores/migration.sql',
      'utf8'
    );
    const expectedColumns = [
      'knowledge_match_score',
      'goal_alignment_score',
      'lead_action_score',
      'response_quality_score'
    ];

    await initializeSchema(database);

    for (const column of expectedColumns) {
      const statement = `alter table reasoning_traces add column if not exists ${column} numeric(4, 3)`;
      assert.ok(startupSchemaSql.toLowerCase().includes(statement));
      assert.ok(migrationSql.toLowerCase().includes(statement));
    }
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
