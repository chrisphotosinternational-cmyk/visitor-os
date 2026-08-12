import pg from 'pg';
import {
  assertPersistentFixtureGuard,
  cleanupFixtures
} from './chatbot-smoke-staging-fixtures.mjs';

console.warn('STAGING-ONLY: suppression des fixtures persistantes dédiées au smoke chatbot.');
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
    await cleanupFixtures(client);
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
  console.log('Fixtures chatbot smoke supprimées (ou déjà absentes).');
} catch (error) {
  console.error(`[FAIL] ${error instanceof Error ? error.message : 'unknown error'}`);
  process.exitCode = 1;
} finally {
  await pool?.end();
}
