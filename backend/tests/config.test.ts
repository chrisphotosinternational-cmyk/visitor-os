import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadConfig } from '../src/core/config/env.js';

const baseEnv = {
  DATABASE_URL: 'postgresql://visitor_os:visitor_os@localhost:5432/visitor_os'
};

describe('loadConfig', () => {
  it('loads a valid environment with defaults', () => {
    const config = loadConfig(baseEnv);

    assert.equal(config.app.name, 'VISITOR-OS');
    assert.equal(config.app.environment, 'development');
    assert.equal(config.server.port, 3000);
    assert.equal(config.database.url, baseEnv.DATABASE_URL);
    assert.equal(config.database.ssl, false);
  });

  it('parses allowed origins', () => {
    const config = loadConfig({
      ...baseEnv,
      ALLOWED_ORIGINS: 'http://localhost:5173, https://example.com '
    });

    assert.deepEqual(config.security.allowedOrigins, [
      'http://localhost:5173',
      'https://example.com'
    ]);
  });

  it('rejects missing database url', () => {
    assert.throws(() => loadConfig({}), /DATABASE_URL/);
  });
});
