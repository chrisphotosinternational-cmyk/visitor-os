import type { AppCache } from '../cache/app-cache.js';
import type { InMemoryJobQueue } from '../jobs/in-memory-job-queue.js';

export function renderMetrics(input: {
  app: string;
  environment: string;
  uptimeSeconds: number;
  database: string;
  cache: AppCache;
  queue: InMemoryJobQueue;
}): string {
  const cache = input.cache.stats();
  const queue = input.queue.stats();
  const lines = [
    '# HELP visitor_os_uptime_seconds Process uptime in seconds.',
    '# TYPE visitor_os_uptime_seconds gauge',
    `visitor_os_uptime_seconds ${input.uptimeSeconds}`,
    '# HELP visitor_os_database_state Database state where disabled=0 pending=1 ok=2 error=3.',
    '# TYPE visitor_os_database_state gauge',
    `visitor_os_database_state ${databaseStateValue(input.database)}`,
    '# HELP visitor_os_cache_keys Number of active in-memory cache keys.',
    '# TYPE visitor_os_cache_keys gauge',
    `visitor_os_cache_keys ${cache.keys}`,
    '# HELP visitor_os_cache_hits Total in-memory cache hits.',
    '# TYPE visitor_os_cache_hits counter',
    `visitor_os_cache_hits_total ${cache.hits}`,
    '# HELP visitor_os_cache_misses Total in-memory cache misses.',
    '# TYPE visitor_os_cache_misses counter',
    `visitor_os_cache_misses_total ${cache.misses}`,
    '# HELP visitor_os_queue_jobs Number of jobs by status.',
    '# TYPE visitor_os_queue_jobs gauge',
    `visitor_os_queue_jobs{status="queued"} ${queue.queued}`,
    `visitor_os_queue_jobs{status="running"} ${queue.running}`,
    `visitor_os_queue_jobs{status="completed"} ${queue.completed}`,
    `visitor_os_queue_jobs{status="failed"} ${queue.failed}`
  ];

  return `${lines.join('\n')}\n`;
}

function databaseStateValue(state: string): number {
  if (state === 'pending') return 1;
  if (state === 'ok' || state === 'connected') return 2;
  if (state === 'error') return 3;
  return 0;
}
