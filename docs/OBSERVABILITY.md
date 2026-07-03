# Observability

VISITOR-OS exposes lightweight observability primitives for production operations.

## Goals

- Correlate every API request with a trace identifier.
- Keep health and metrics endpoints inexpensive.
- Prepare the codebase for OpenTelemetry without forcing an external collector in beta.
- Avoid blocking application startup if observability tooling is unavailable.

## Trace ID

Every request receives an `x-trace-id` response header.

If the incoming request contains a valid W3C `traceparent` header, VISITOR-OS reuses its trace id. Otherwise, the backend creates a random 32-character hexadecimal trace id.

The trace id is available to backend services through the request context and is stored in audit entries when relevant.

## OpenTelemetry Readiness

The beta implementation keeps OpenTelemetry compatible boundaries without adding a mandatory collector.

Configuration:

- `OTEL_ENABLED`
- `OTEL_SERVICE_NAME`

The `/health` endpoint reports whether OpenTelemetry is enabled and which service name is configured.

## Tracing Scope

The following areas are prepared for tracing:

- API requests
- PostgreSQL operations
- Queue jobs
- AI analysis
- Public enrichment

In beta, this is intentionally lightweight. Full exporter integration can be added later without changing the route structure.

## Health And Metrics

Endpoints:

- `GET /live`
- `GET /ready`
- `GET /health`
- `GET /metrics`

`/ready` must stay fast and must not perform long blocking checks.

