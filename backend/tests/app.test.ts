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
});
