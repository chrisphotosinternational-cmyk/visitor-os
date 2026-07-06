import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import { loadConfig } from '../src/core/config/env.js';
import type { Database } from '../src/database/client.js';
import { ProductionValidationService } from '../src/modules/production-validation/production-validation-service.js';

describe('production validation service', () => {
  it('detects import quality issues before CSV import', async () => {
    const service = new ProductionValidationService({
      database: fakeDatabase(),
      config: loadConfig({ NODE_ENV: 'test', LOG_LEVEL: 'silent' })
    });

    const result = service.importIntelligence(`email,phone,city,unknown_column
emma@example.com,+33600000000,Albi,value
bad-email,123,,value
emma@example.com,+33600000000,Albi,value`);

    assert.equal(result.rows, 3);
    assert.equal(result.duplicates, 1);
    assert.equal(result.invalidEmails, 1);
    assert.equal(result.invalidPhones, 1);
    assert.equal(result.unknownCities, 1);
    assert.deepEqual(result.ignoredColumns, ['unknown_column']);
    assert.ok(result.correctionProposals.length >= 3);
  });

  it('builds a CRM quality report from PostgreSQL aggregates', async () => {
    const service = new ProductionValidationService({
      database: fakeDatabase([
        {
          total: '10',
          incomplete: '2',
          without_contact: '3',
          never_contacted: '4',
          average_score: '62',
          invalid_email: '1',
          missing_city: '2'
        }
      ]),
      config: loadConfig({ NODE_ENV: 'test', LOG_LEVEL: 'silent' })
    });

    const report = await service.qualityReport('00000000-0000-4000-8000-000000000001');

    assert.equal(report.errors, 6);
    assert.equal(report.incompleteData, 2);
    assert.equal(report.prospectsWithoutContact, 3);
    assert.equal(report.prospectsNeverFollowedUp, 4);
    assert.equal(report.averageScore, 62);
    assert.equal(report.crmQuality, 88);
  });

  it('exports a downloadable ZIP backup without password hashes', async () => {
    const calls: string[] = [];
    const service = new ProductionValidationService({
      database: fakeDatabase([], calls),
      config: loadConfig({ NODE_ENV: 'test', LOG_LEVEL: 'silent' })
    });

    const backup = await service.fullBackup('00000000-0000-4000-8000-000000000001');

    assert.match(backup.filename, /^visitor-os-backup-/);
    assert.equal(backup.content.subarray(0, 4).toString('hex'), '504b0304');
    assert.ok(calls.some((query) => query.includes('from prospects')));
    assert.equal(backup.content.includes('password_hash'), false);
  });
});

function fakeDatabase(rows: Array<Record<string, unknown>> = [], calls: string[] = []): Database {
  return {
    isConfigured: mock.fn(() => true),
    checkConnection: mock.fn(async () => undefined),
    query: mock.fn(async (query: string) => {
      calls.push(query);
      return { rows } as never;
    }),
    close: mock.fn(async () => undefined)
  };
}
