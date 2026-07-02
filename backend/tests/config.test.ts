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
    assert.equal(config.notifications.fromEmail, 'notifications@visitor-os.local');
    assert.equal(config.notifications.retryAttempts, 2);
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

  it('allows production boot without optional deployment variables', () => {
    const config = loadConfig({
      ...baseEnv,
      NODE_ENV: 'production'
    });

    assert.equal(config.app.environment, 'production');
    assert.deepEqual(config.security.allowedOrigins, []);
    assert.notEqual(config.auth.sessionSecret, 'dev-only-session-secret-change-before-production');
  });

  it('accepts postgres connection strings from managed providers', () => {
    const config = loadConfig({
      DATABASE_URL: 'postgres://visitor_os:visitor_os@localhost:5432/visitor_os'
    });

    assert.equal(
      config.database.url,
      'postgres://visitor_os:visitor_os@localhost:5432/visitor_os'
    );
  });
});
