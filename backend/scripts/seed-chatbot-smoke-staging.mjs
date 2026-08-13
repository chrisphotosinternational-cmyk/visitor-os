import pg from 'pg';
import {
  assertPersistentFixtureGuard,
  seedFixtures,
  smokeEnvironmentLines
} from './chatbot-smoke-staging-fixtures.mjs';

console.warn(
  'STAGING-ONLY: création/mise à jour de fixtures persistantes dédiées au smoke chatbot.'
);
let pool;
try {
  assertPersistentFixtureGuard(process.env);
  pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
  });
  const client = await pool.connect();
  try {
    await client.query('begin');
    await seedFixtures(client);
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
  console.log(
    '\nFixtures prêtes. Variables publiques à utiliser :\n' + smokeEnvironmentLines().join('\n')
  );
} catch (error) {
  console.error(`[FAIL] ${error instanceof Error ? error.message : 'unknown error'}`);
  process.exitCode = 1;
} finally {
  await pool?.end();
}
