import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import pg from 'pg';
import {
  ALLOW_FLAG,
  SMOKE_BUSINESS_CONFIG_ID,
  SMOKE_ORGANIZATIONS,
  SMOKE_SITES,
  assertPersistentFixtureGuard,
  cleanupFixtures,
  seedFixtures,
  tokenizeSmokeKnowledge
} from './chatbot-smoke-staging-fixtures.mjs';

describe('chatbot smoke staging fixture manifest', () => {
  for (const shell of ['bash', 'zsh']) {
    it(`loads .env.chatbot-smoke.example safely with ${shell}`, (context) => {
      const availability = spawnSync(shell, ['--version'], { encoding: 'utf8' });
      if (availability.error?.code === 'ENOENT') {
        context.skip(`${shell} is not installed`);
        return;
      }

      const environmentFile = fileURLToPath(
        new URL('../.env.chatbot-smoke.example', import.meta.url)
      );
      const result = spawnSync(
        shell,
        ['-c', 'set -a; source "$1"; set +a; env -0', 'chatbot-smoke-env', environmentFile],
        { encoding: 'utf8', env: {} }
      );
      assert.equal(result.status, 0, result.stderr);
      const loaded = Object.fromEntries(
        result.stdout
          .split('\0')
          .filter(Boolean)
          .map((entry) => {
            const separator = entry.indexOf('=');
            return [entry.slice(0, separator), entry.slice(separator + 1)];
          })
      );
      assert.equal(loaded.CHATBOT_SMOKE_ALLOW_PERSISTENT_FIXTURES, 'true');
      assert.equal(
        loaded.CHATBOT_SMOKE_SIMPLE_QUESTION,
        'Quelle est la réponse simple synthétique ?'
      );
      assert.equal(
        loaded.CHATBOT_SMOKE_PRICING_EXPECT_JSON,
        '["SMOKE-A1-PRICE-START-420","SMOKE-A1-PRICE-DURATION-3H","SMOKE-A1-PRICE-DELIVERY-200"]'
      );
      assert.equal(
        loaded.CHATBOT_SMOKE_MULTIPART_QUESTION,
        'Quels sont le check-in, le parking et le petit-déjeuner synthétiques ?'
      );
      assert.equal(
        loaded.CHATBOT_SMOKE_MULTIPART_EXPECT_JSON,
        '["SMOKE-A1-MULTI-CHECKIN-17H","SMOKE-A1-MULTI-PARKING-VIOLET","SMOKE-A1-MULTI-BREAKFAST-07H30"]'
      );
      assert.equal(
        loaded.CHATBOT_SMOKE_MISSING_QUESTION,
        'Quel est le code de la navette lunaire SMOKE-MISSING-NEBULA-999 ?'
      );
    });
  }

  it('has exactly two isolated organizations and three deterministic sites', () => {
    assert.equal(SMOKE_BUSINESS_CONFIG_ID, 'chatbot-smoke-staging');
    assert.equal(SMOKE_ORGANIZATIONS.length, 2);
    assert.equal(SMOKE_SITES.length, 3);
    assert.equal(SMOKE_SITES[0].organizationId, SMOKE_SITES[1].organizationId);
    assert.notEqual(SMOKE_SITES[0].organizationId, SMOKE_SITES[2].organizationId);
    assert.equal(new Set(SMOKE_SITES.map(({ key }) => key)).size, 3);
    assert.equal(new Set(SMOKE_SITES.map(({ origin }) => origin)).size, 3);
  });

  it('assigns and restores the dedicated business configuration on every seed', async () => {
    const statements = [];
    const client = {
      async query(sql, values = []) {
        statements.push({ sql, values });
        return { rows: [] };
      }
    };
    await seedFixtures(client);
    const siteInserts = statements.filter(({ sql }) => /insert into sites/i.test(sql));
    assert.equal(siteInserts.length, 3);
    for (const { sql, values } of siteInserts) {
      assert.match(sql, /business_config_id/);
      assert.match(sql, /business_config_id=excluded\.business_config_id/);
      assert.equal(values[5], SMOKE_BUSINESS_CONFIG_ID);
    }
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

  it('normalizes fixture tokens exactly like KMS queries', () => {
    assert.deepEqual(tokenizeSmokeKnowledge('Réponse reponse SYNTHÉTIQUE !'), [
      'reponse',
      'synthetique'
    ]);
    const queryTokens = tokenizeSmokeKnowledge('Quelle est la réponse simple synthétique ?');
    const fixtureTokens = tokenizeSmokeKnowledge(SMOKE_SITES[0].content);
    const overlap = queryTokens.filter((token) => fixtureTokens.includes(token));
    assert.deepEqual(overlap, ['est', 'reponse', 'simple', 'synthetique']);
    assert.equal(overlap.length * 0.22, 0.88);
  });

  it('requires the opt-in value to be exactly true', () => {
    for (const value of [undefined, '', 'TRUE', '1', ' true ']) {
      assert.throws(
        () =>
          assertPersistentFixtureGuard({
            [ALLOW_FLAG]: value,
            DATABASE_URL: 'postgresql://staging.example/visitor_os'
          }),
        new RegExp(ALLOW_FLAG)
      );
    }
  });

  it('requires a valid PostgreSQL DATABASE_URL with a hostname', () => {
    for (const databaseUrl of [
      undefined,
      'not a URL',
      'http://staging.example/visitor_os',
      'mysql://staging.example/visitor_os',
      'postgresql:///visitor_os'
    ]) {
      assert.throws(
        () => assertPersistentFixtureGuard({ [ALLOW_FLAG]: 'true', DATABASE_URL: databaseUrl }),
        /DATABASE_URL/
      );
    }

    assert.doesNotThrow(() =>
      assertPersistentFixtureGuard({
        [ALLOW_FLAG]: 'true',
        DATABASE_URL: 'postgresql://user:secret@staging.example:5432/visitor_os'
      })
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
    assert.match(statements.join('\n'), /where \(id, slug\) in/);
    assert.doesNotMatch(statements.join('\n'), /id = any\([^)]*\) and slug = any/);
  });

  it('blocks an organization collision before every destructive statement', async () => {
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
    assert.equal(statements.length, 1);
    assert.equal(statements.some(isDestructiveStatement), false);
  });

  for (const collision of [
    { label: 'id', row: { id: SMOKE_SITES[0].id, slug: 'unrelated', widget_public_key: 'other' } },
    {
      label: 'slug',
      row: {
        id: '5affffff-0000-4000-8000-000000000002',
        slug: SMOKE_SITES[0].slug,
        widget_public_key: 'other'
      }
    },
    {
      label: 'widget_public_key',
      row: {
        id: '5affffff-0000-4000-8000-000000000003',
        slug: 'unrelated',
        widget_public_key: SMOKE_SITES[0].key
      }
    }
  ]) {
    it(`blocks a site ${collision.label} collision before every destructive statement`, async () => {
      const statements = [];
      const client = {
        async query(sql) {
          statements.push(sql);
          return sql.includes('select id::text, slug, widget_public_key from sites')
            ? { rows: [collision.row] }
            : { rows: [] };
        }
      };

      await assert.rejects(() => cleanupFixtures(client), /site identity collision/);
      assert.equal(statements.length, 2);
      assert.equal(statements.some(isDestructiveStatement), false);
    });
  }
});

function isDestructiveStatement(sql) {
  return /^\s*(?:delete|truncate|do\s+\$\$)/i.test(sql);
}
