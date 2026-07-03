import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AppCache } from '../src/core/cache/app-cache.js';
import { InMemoryJobQueue } from '../src/core/jobs/in-memory-job-queue.js';
import { renderMetrics } from '../src/core/monitoring/metrics.js';
import { SettingsService } from '../src/modules/settings/settings-service.js';
import type { Database } from '../src/database/client.js';

describe('production readiness utilities', () => {
  it('caches values with TTL stats and tag invalidation', async () => {
    const cache = new AppCache({ enabled: true, defaultTtlMs: 1000 });
    let calls = 0;
    const producer = async () => {
      calls += 1;
      return { value: calls };
    };

    const first = await cache.getOrSet('dashboard:org-a', ['dashboard'], producer);
    const second = await cache.getOrSet('dashboard:org-a', ['dashboard'], producer);
    const invalidated = cache.invalidateTags(['dashboard']);
    const third = await cache.getOrSet('dashboard:org-a', ['dashboard'], producer);

    assert.deepEqual(first, { value: 1 });
    assert.deepEqual(second, { value: 1 });
    assert.deepEqual(third, { value: 2 });
    assert.equal(invalidated, 1);
    assert.equal(cache.stats().hits, 1);
    assert.equal(cache.stats().misses, 2);
  });

  it('runs queued jobs and exposes queue metrics', async () => {
    const queue = new InMemoryJobQueue();
    let completed = false;

    const job = queue.enqueue('test-job', async () => {
      completed = true;
    });

    await waitFor(() => queue.get(job.id)?.status === 'completed');

    assert.equal(completed, true);
    assert.equal(queue.stats().completed, 1);
  });

  it('renders production metrics in a monitoring-friendly format', () => {
    const cache = new AppCache({ enabled: true, defaultTtlMs: 1000 });
    const queue = new InMemoryJobQueue();
    const metrics = renderMetrics({
      app: 'VISITOR-OS',
      environment: 'test',
      uptimeSeconds: 42,
      database: 'ok',
      cache,
      queue
    });

    assert.match(metrics, /visitor_os_uptime_seconds 42/);
    assert.match(metrics, /visitor_os_database_state 2/);
    assert.match(metrics, /visitor_os_cache_keys 0/);
  });

  it('uses safe feature flag and runtime setting defaults without PostgreSQL', async () => {
    const database: Database = {
      isConfigured: () => false,
      checkConnection: async () => undefined,
      query: async () => ({ rows: [] }) as never,
      close: async () => undefined
    };
    const settings = new SettingsService(database);

    const flags = await settings.featureFlags();
    const runtimeSettings = await settings.runtimeSettings();

    assert.equal(flags.ai, true);
    assert.equal(flags.enrichment, true);
    assert.equal(flags.exports, true);
    assert.equal(runtimeSettings.scoring.email, 15);
    assert.equal(runtimeSettings.cache.ttlMs, 30000);
  });
});

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.fail('Condition was not reached in time');
}
