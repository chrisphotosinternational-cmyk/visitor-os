# Central Configuration

VISITOR-OS keeps runtime configuration in one central settings layer.

## Configurable Areas

- Scoring weights
- Pipeline stale period
- Forecast conversion rates
- Average deal value
- Enrichment and notification timeouts
- Rate limits
- Batch size
- Cache TTL

## Storage

Runtime settings are stored in PostgreSQL in `app_settings` under the key `runtime_settings`.

Settings can be global or scoped to an organization.

## Admin Editing

The admin settings page exposes feature flags and runtime settings. The runtime settings editor uses JSON in beta to avoid prematurely building many small screens.

## Defaults

If no database is configured or no settings record exists, VISITOR-OS uses safe application defaults.

## Rule

New configurable business constants should be added to the central settings service before being used by product modules.

