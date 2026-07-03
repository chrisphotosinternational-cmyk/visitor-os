# Release Notes - 1.0.0-beta

## Summary

VISITOR-OS 1.0.0-beta is the first production-readiness milestone.

It keeps the existing product scope unchanged and focuses on:

- performance;
- stability;
- health monitoring;
- cache;
- queue abstraction;
- file logs;
- backup and deployment documentation.

## Added

- Production performance report.
- PostgreSQL performance indexes.
- In-memory TTL cache for dashboard, pipeline metrics, forecast and AI analysis.
- In-memory queue wrapper for batch AI and batch enrichment.
- Extended `/health` response.
- New `/metrics` endpoint.
- Runtime file log support for `application.log`, `error.log` and `audit.log`.
- Production documentation updates.

## Validation

Required before deployment:

```bash
pnpm --dir backend typecheck
pnpm --dir backend lint
pnpm --dir backend build
pnpm --dir backend test
```

## Known Limits

- Cache and queue are process-local.
- Large CSV exports are still synchronous.
- Real production load testing must be executed against the managed PostgreSQL instance.
