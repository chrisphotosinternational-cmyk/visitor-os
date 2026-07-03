# Known Limitations - 1.0.0-beta

VISITOR-OS is beta-ready, not enterprise-scale yet.

## Infrastructure

- Cache is in-memory and process-local.
- Queue is in-memory and process-local.
- Horizontal scaling requires Redis or a managed queue.
- File logs are optional and should not be used as the only production log sink.

## Product

- No automatic outreach.
- No payment, booking or WhatsApp automation.
- AI qualification is deterministic/currently local unless a provider is configured.
- Public enrichment never bypasses login, captcha, paywall or private areas.

## Data

- Large imports should be tested with real production datasets before public launch.
- Large exports are still synchronous.
- Search uses simple filters; advanced full-text search can come later.

## Security

- No 2FA yet.
- No password reset flow yet.
- No dedicated CSRF token for cookie-authenticated legacy admin routes.
- `/metrics` should be protected at platform/network level if publicly reachable.

## Observability

- Trace IDs are generated and propagated with `x-trace-id`.
- OpenTelemetry-compatible trace context is prepared, but no external collector/exporter is required in beta.
- Feature flags are stored in PostgreSQL; if the database is disabled, defaults are used.
- Runtime settings are edited as JSON in beta.
- Frontend coverage is not yet enforced with a numeric threshold.
- Audit trail failures do not block user workflows.
- Queue processing remains in-process and should be replaced before heavy workloads.

## Production Rule

Before opening VISITOR-OS to broader usage, validate PostgreSQL backups, Railway variables, health checks, and admin access on the target environment.
