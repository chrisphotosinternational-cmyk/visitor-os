import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/core/config/env.js';
import { createLogger } from '../src/core/logger/logger.js';
import type { Database } from '../src/database/client.js';

describe('createApp', () => {
  it('starts technical health route without business endpoints', async () => {
    const database: Database = {
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
      environment: string;
    } = response.json();

    assert.deepEqual(body, {
      status: 'ok',
      app: 'VISITOR-OS',
      environment: 'test'
    });

    await app.close();
  });

  it('adds basic security headers', async () => {
    const app = await createApp({
      config: loadConfig({
        NODE_ENV: 'test',
        LOG_LEVEL: 'silent',
        DATABASE_URL: 'postgresql://visitor_os:visitor_os@localhost:5432/visitor_os'
      }),
      database: {
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

  it('returns validation errors as bad requests', async () => {
    const app = await createApp({
      config: loadConfig({
        NODE_ENV: 'test',
        LOG_LEVEL: 'silent',
        DATABASE_URL: 'postgresql://visitor_os:visitor_os@localhost:5432/visitor_os'
      }),
      database: {
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
