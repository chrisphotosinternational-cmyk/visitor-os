# Performance

## Sprint 12 Baseline

VISITOR-OS is optimized for a single-service beta deployment with managed PostgreSQL.

The production strategy is intentionally simple:

- PostgreSQL indexes for all common filters;
- pagination on CRM lists;
- hard limits on activity/follow-up feeds;
- short in-memory TTL cache for aggregate reads;
- in-memory queue abstraction for batch work;
- `/metrics` endpoint for minimal monitoring.

## Cached Routes

The cache is used for:

- `/admin-api/dashboard`;
- `/admin-api/pipeline/metrics`;
- `/admin-api/pipeline/forecast`;
- `/admin-api/prospects/:id/analysis`.

Configuration:

```text
CACHE_ENABLED=true
CACHE_TTL_MS=30000
```

## Invalidation

Successful admin mutations invalidate:

- dashboard;
- pipeline;
- forecast;
- AI analysis;
- statistics.

This broad invalidation avoids stale commercial data while keeping implementation low-maintenance.

## Queue

Batch AI analysis and batch enrichment run through an in-memory queue. The queue is synchronous-process friendly and exposes status through `/health` and `/metrics`.

Future migration target:

- BullMQ + Redis;
- managed queue;
- persistent job table.

## PostgreSQL

Sprint 12 adds production indexes in:

```text
backend/prisma/migrations/202607037_production_performance_indexes/migration.sql
```

The indexes cover prospects, contact history, AI analysis, enrichments, field suggestions, users, organizations and CRM activity.

## Limits

This is beta-ready, not high-scale enterprise infrastructure.

Move to Redis and persistent workers when:

- multiple backend replicas are required;
- imports exceed tens of thousands of rows regularly;
- exports become frequent or large;
- batch enrichment/AI jobs run for several minutes.
