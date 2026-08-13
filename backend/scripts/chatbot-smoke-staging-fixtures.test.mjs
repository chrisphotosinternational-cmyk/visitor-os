import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import pg from 'pg';
import {
  ALLOW_FLAG,
  SMOKE_ORGANIZATIONS,
  SMOKE_SITES,
  assertPersistentFixtureGuard,
  cleanupFixtures,
  seedFixtures
} from './chatbot-smoke-staging-fixtures.mjs';

describe('chatbot smoke staging fixture manifest', () => {
  it('has exactly two isolated organizations and three deterministic sites', () => {
    assert.equal(SMOKE_ORGANIZATIONS.length, 2);
    assert.equal(SMOKE_SITES.length, 3);
    assert.equal(SMOKE_SITES[0].organizationId, SMOKE_SITES[1].organizationId);
    assert.notEqual(SMOKE_SITES[0].organizationId, SMOKE_SITES[2].organizationId);
    assert.equal(new Set(SMOKE_SITES.map(({ key }) => key)).size, 3);
    assert.equal(new Set(SMOKE_SITES.map(({ origin }) => origin)).size, 3);
  });

  it('contains required knowledge without cross-organization leakage', () => {
    const [a1, a2, b1] = SMOKE_SITES;
    for (const marker of [
      'SMOKE-A1-SIMPLE-ORCHID',
      'SMOKE-A1-PRICE-START-420',
      'SMOKE-A1-PRICE-DURATION-3H',
      'SMOKE-A1-PRICE-DELIVERY-200',
      'SMOKE-A1-MULTI-CHECKIN-17H',
      'SMOKE-A1-MULTI-PARKING-VIOLET',
      'SMOKE-A1-MULTI-BREAKFAST-07H30',
      'SMOKE-SITE-A1-MARKER-ORCHID',
      'SMOKE-ORG-A-MARKER-COPPER'
    ])
      assert.match(a1.content, new RegExp(marker));
    assert.match(a2.content, /SMOKE-SITE-A2-MARKER-SAFFRON/);
    assert.match(a2.content, /SMOKE-ORG-A-MARKER-COPPER/);
    assert.match(b1.content, /SMOKE-SITE-B1-MARKER-INDIGO/);
    assert.match(b1.content, /SMOKE-ORG-B-MARKER-SILVER/);
    assert.doesNotMatch(a1.content + a2.content, /SMOKE-(?:SITE-)?B1|SMOKE-ORG-B/);
    assert.doesNotMatch(b1.content, /SMOKE-(?:SITE-)?A[12]|SMOKE-ORG-A/);
  });

  it('requires the explicit guard and DATABASE_URL', () => {
    assert.throws(
      () => assertPersistentFixtureGuard({ DATABASE_URL: 'postgres://example' }),
      new RegExp(ALLOW_FLAG)
    );
    assert.throws(() => assertPersistentFixtureGuard({ [ALLOW_FLAG]: 'true' }), /DATABASE_URL/);
    assert.throws(
      () =>
        assertPersistentFixtureGuard({
          [ALLOW_FLAG]: 'true',
          DATABASE_URL: 'https://not-postgresql.example'
        }),
      /valid PostgreSQL URL/
    );
  });

  for (const command of ['seed-chatbot-smoke-staging.mjs', 'cleanup-chatbot-smoke-staging.mjs']) {
    it(`${command} refuses to run without the explicit opt-in`, () => {
      const result = spawnSync(
        process.execPath,
        [fileURLToPath(new URL(command, import.meta.url))],
        {
          encoding: 'utf8',
          env: {
            ...process.env,
            DATABASE_URL: 'postgresql://example.invalid/staging',
            [ALLOW_FLAG]: ''
          }
        }
      );
      assert.equal(result.status, 1);
      assert.match(result.stderr, new RegExp(`${ALLOW_FLAG}=true is required`));
    });
  }
});

describe('chatbot smoke staging PostgreSQL lifecycle', () => {
  it(
    'is seed- and cleanup-idempotent and preserves a non-smoke row',
    { skip: process.env.TEST_DATABASE_URL ? false : 'Set TEST_DATABASE_URL to run' },
    async () => {
      const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
      const markerId = '5affffff-0000-4000-8000-000000000001';
      try {
        await pool.query(
          "insert into organizations (id,name,slug) values ($1,'Smoke lifecycle sentinel','smoke-lifecycle-non-fixture') on conflict (id) do nothing",
          [markerId]
        );
        await seedFixtures(pool);
        await seedFixtures(pool);
        const counts = await pool.query(
          `select
        (select count(*)::int from organizations where id=any($1)) organizations,
        (select count(*)::int from sites where id=any($2)) sites`,
          [SMOKE_ORGANIZATIONS.map(({ id }) => id), SMOKE_SITES.map(({ id }) => id)]
        );
        assert.deepEqual(counts.rows[0], { organizations: 2, sites: 3 });
        await cleanupFixtures(pool);
        await cleanupFixtures(pool);
        assert.equal(
          (
            await pool.query('select count(*)::int count from organizations where id=$1', [
              markerId
            ])
          ).rows[0].count,
          1
        );
      } finally {
        await pool.query('delete from organizations where id=$1', [markerId]);
        await pool.end();
      }
    }
  );
});

describe('chatbot smoke cleanup targeting', () => {
  it('never performs an organization-wide dependent-row deletion', async () => {
    const statements = [];
    const client = {
      async query(sql) {
        statements.push(sql);
        return { rows: [] };
      }
    };

    await cleanupFixtures(client);
    assert.equal(
      statements.some(
        (sql) =>
          sql.includes('information_schema.columns') &&
          sql.includes("column_name='organization_id'")
      ),
      false
    );
    assert.match(statements.join('\n'), /site_id = any/);
    assert.match(statements.join('\n'), /delete from messages where conversation_id/);
  });

  it('aborts before deletion when a reserved identity belongs to another row', async () => {
    const statements = [];
    const client = {
      async query(sql) {
        statements.push(sql);
        if (sql.includes('select id::text, slug from organizations')) {
          return { rows: [{ id: SMOKE_ORGANIZATIONS[0].id, slug: 'unrelated-organization' }] };
        }
        return { rows: [] };
      }
    };

    await assert.rejects(() => cleanupFixtures(client), /identity collision/);
    assert.equal(
      statements.some((sql) => /^\s*delete\s/i.test(sql)),
      false
    );
  });
});
