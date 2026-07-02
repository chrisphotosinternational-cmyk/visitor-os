# Reporting

Sprint 9 adds basic analytics reporting exports.

## Export Formats

- CSV
- XLSX-compatible Spreadsheet XML

## Filters

Exports support:

- period preset
- custom date range
- organization
- site

## Endpoint

```text
GET /api/admin/analytics/export
```

The route requires the `data:export` permission and respects organization isolation.

## Future

Future reporting may add:

- scheduled reports
- PDF summaries
- email delivery through Notification Engine
- saved report presets

These are intentionally out of scope for Sprint 9.
