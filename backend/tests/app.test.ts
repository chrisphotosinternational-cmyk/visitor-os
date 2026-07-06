import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/core/config/env.js';
import { createLogger } from '../src/core/logger/logger.js';
import type { Database } from '../src/database/client.js';

describe('createApp', () => {
  it('serves the admin login page from the root route', async () => {
    const app = await createApp({
      config: loadConfig({
        NODE_ENV: 'test',
        LOG_LEVEL: 'silent'
      }),
      database: {
        isConfigured: mock.fn(() => false),
        checkConnection: mock.fn(async () => undefined),
        query: mock.fn(async () => ({ rows: [] }) as never),
        close: mock.fn(async () => undefined)
      },
      logger: createLogger()
    });

    const response = await app.inject({
      method: 'GET',
      url: '/'
    });

    assert.equal(response.statusCode, 200);
    assert.match(response.headers['content-type'] ?? '', /text\/html/);
    assert.match(response.body, /Connexion admin VISITOR-OS/);

    await app.close();
  });

  it('serves admin static assets and falls back SPA routes to index.html', async () => {
    const app = await createApp({
      config: loadConfig({
        NODE_ENV: 'test',
        LOG_LEVEL: 'silent'
      }),
      database: {
        isConfigured: mock.fn(() => false),
        checkConnection: mock.fn(async () => undefined),
        query: mock.fn(async () => ({ rows: [] }) as never),
        close: mock.fn(async () => undefined)
      },
      logger: createLogger()
    });

    const script = await app.inject({ method: 'GET', url: '/app.js' });
    const spaRoute = await app.inject({ method: 'GET', url: '/admin/settings' });
    const apiRoute = await app.inject({ method: 'GET', url: '/api/unknown' });

    assert.equal(script.statusCode, 200);
    assert.match(script.headers['content-type'] ?? '', /application\/javascript/);
    assert.match(script.body, /POST/);
    assert.match(script.body, /AI Analysis/);
    assert.match(script.body, /Top prospects IA/);
    assert.equal(spaRoute.statusCode, 200);
    assert.match(spaRoute.body, /Connexion admin VISITOR-OS/);
    assert.equal(apiRoute.statusCode, 404);

    await app.close();
  });

  it('serves the public widget script for Moto CMS integration', async () => {
    const app = await createApp({
      config: loadConfig({
        NODE_ENV: 'test',
        LOG_LEVEL: 'silent'
      }),
      database: {
        isConfigured: mock.fn(() => false),
        checkConnection: mock.fn(async () => undefined),
        query: mock.fn(async () => ({ rows: [] }) as never),
        close: mock.fn(async () => undefined)
      },
      logger: createLogger()
    });

    const response = await app.inject({
      method: 'GET',
      url: '/widget/demo-site-key.js'
    });

    assert.equal(response.statusCode, 200);
    assert.match(response.headers['content-type'] ?? '', /application\/javascript/);
    assert.match(response.body, /visitor-os-launcher/);
    assert.match(response.body, /visitor-os-anonymous-id/);

    await app.close();
  });

  it('starts technical health route without business endpoints', async () => {
    const previousAppVersion = process.env.APP_VERSION;
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.APP_VERSION = 'v1.0.0-RC1';
    process.env.NODE_ENV = 'production';

    const database: Database = {
      isConfigured: mock.fn(() => true),
      checkConnection: mock.fn(async () => undefined),
      query: mock.fn(async () => ({ rows: [] }) as never),
      close: mock.fn(async () => undefined)
    };
    const app = await createApp({
      config: loadConfig({
        NODE_ENV: 'test',
        LOG_LEVEL: 'silent',
        DATABASE_URL: 'postgresql://visitor_os:visitor_os@localhost:5432/visitor_os'
      }),
      database,
      logger: createLogger()
    });

    const response = await app.inject({
      method: 'GET',
      url: '/health'
    });

    assert.equal(response.statusCode, 200);
    const body: {
      status: string;
      app: string;
      version: string;
      environment: string;
      database: string;
      cache: { enabled: boolean };
      queue: { enabled: boolean };
      openTelemetry: { enabled: boolean; serviceName: string };
      uptime: number;
    } = response.json();

    assert.equal(body.status, 'ok');
    assert.equal(body.app, 'VISITOR-OS');
    assert.equal(body.version, 'v1.0.0-RC1');
    assert.equal(body.environment, 'production');
    assert.equal(body.database, 'ok');
    assert.equal(body.cache.enabled, true);
    assert.equal(body.queue.enabled, true);
    assert.equal(body.openTelemetry.enabled, true);
    assert.equal(body.openTelemetry.serviceName, 'visitor-os-backend');
    assert.equal(typeof body.uptime, 'number');

    await app.close();
    restoreOptionalEnv('APP_VERSION', previousAppVersion);
    restoreOptionalEnv('NODE_ENV', previousNodeEnv);
  });

  it('adds basic security headers', async () => {
    const app = await createApp({
      config: loadConfig({
        NODE_ENV: 'test',
        LOG_LEVEL: 'silent',
        DATABASE_URL: 'postgresql://visitor_os:visitor_os@localhost:5432/visitor_os'
      }),
      database: {
        isConfigured: mock.fn(() => true),
        checkConnection: mock.fn(async () => undefined),
        query: mock.fn(async () => ({ rows: [] }) as never),
        close: mock.fn(async () => undefined)
      },
      logger: createLogger()
    });

    const response = await app.inject({
      method: 'GET',
      url: '/health'
    });

    assert.equal(response.headers['x-content-type-options'], 'nosniff');
    assert.equal(response.headers['x-frame-options'], 'DENY');
    assert.equal(response.headers['referrer-policy'], 'no-referrer');

    await app.close();
  });

  it('adds a trace id header to every request', async () => {
    const app = await createApp({
      config: loadConfig({
        NODE_ENV: 'test',
        LOG_LEVEL: 'silent'
      }),
      database: {
        isConfigured: mock.fn(() => false),
        checkConnection: mock.fn(async () => undefined),
        query: mock.fn(async () => ({ rows: [] }) as never),
        close: mock.fn(async () => undefined)
      },
      logger: createLogger()
    });

    const response = await app.inject({
      method: 'GET',
      url: '/health'
    });

    assert.equal(response.statusCode, 200);
    assert.match(String(response.headers['x-trace-id']), /^[a-f0-9]{32}$/);

    await app.close();
  });

  it('exposes liveness and readiness probes', async () => {
    let connectionChecks = 0;
    const readiness = {
      database: 'pending' as 'disabled' | 'pending' | 'ok' | 'error'
    };
    const database: Database = {
      isConfigured: mock.fn(() => true),
      async checkConnection() {
        connectionChecks += 1;
      },
      query: mock.fn(async () => ({ rows: [] }) as never),
      close: mock.fn(async () => undefined)
    };
    const app = await createApp({
      config: loadConfig({
        NODE_ENV: 'test',
        LOG_LEVEL: 'silent',
        DATABASE_URL: 'postgresql://visitor_os:visitor_os@localhost:5432/visitor_os'
      }),
      database,
      logger: createLogger(),
      readiness
    });

    const live = await app.inject({ method: 'GET', url: '/live' });
    const ready = await app.inject({ method: 'GET', url: '/ready' });

    assert.equal(live.statusCode, 200);
    assert.equal((live.json() as { status: string }).status, 'alive');
    assert.equal(ready.statusCode, 200);
    assert.equal((ready.json() as { status: string; database: string }).database, 'pending');
    assert.equal(connectionChecks, 0);

    await app.close();
  });

  it('exposes production metrics without querying PostgreSQL', async () => {
    const app = await createApp({
      config: loadConfig({
        NODE_ENV: 'test',
        LOG_LEVEL: 'silent',
        DATABASE_URL: 'postgresql://visitor_os:visitor_os@localhost:5432/visitor_os'
      }),
      database: {
        isConfigured: mock.fn(() => true),
        checkConnection: mock.fn(async () => undefined),
        query: mock.fn(async () => ({ rows: [] }) as never),
        close: mock.fn(async () => undefined)
      },
      logger: createLogger(),
      readiness: { database: 'pending' }
    });

    const response = await app.inject({ method: 'GET', url: '/metrics' });

    assert.equal(response.statusCode, 200);
    assert.match(response.headers['content-type'] ?? '', /text\/plain/);
    assert.match(response.body, /visitor_os_uptime_seconds/);
    assert.match(response.body, /visitor_os_database_state 1/);

    await app.close();
  });

  it('returns validation errors as bad requests', async () => {
    const app = await createApp({
      config: loadConfig({
        NODE_ENV: 'test',
        LOG_LEVEL: 'silent',
        DATABASE_URL: 'postgresql://visitor_os:visitor_os@localhost:5432/visitor_os'
      }),
      database: {
        isConfigured: mock.fn(() => true),
        checkConnection: mock.fn(async () => undefined),
        query: mock.fn(async () => ({ rows: [] }) as never),
        close: mock.fn(async () => undefined)
      },
      logger: createLogger()
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/widget/conversations',
      payload: {}
    });

    assert.equal(response.statusCode, 400);
    assert.equal((response.json() as { error: { code: string } }).error.code, 'VALIDATION_ERROR');

    await app.close();
  });

  it('rate limits repeated requests', async () => {
    const app = await createApp({
      config: loadConfig({
        NODE_ENV: 'test',
        LOG_LEVEL: 'silent',
        RATE_LIMIT_MAX_REQUESTS: '1',
        DATABASE_URL: 'postgresql://visitor_os:visitor_os@localhost:5432/visitor_os'
      }),
      database: {
        isConfigured: mock.fn(() => true),
        checkConnection: mock.fn(async () => undefined),
        query: mock.fn(async () => ({ rows: [] }) as never),
        close: mock.fn(async () => undefined)
      },
      logger: createLogger()
    });

    await app.inject({
      method: 'GET',
      url: '/api/admin/prospects'
    });
    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/prospects'
    });

    assert.equal(response.statusCode, 429);
    assert.equal((response.json() as { error: { code: string } }).error.code, 'RATE_LIMITED');

    await app.close();
  });
});

function restoreOptionalEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
