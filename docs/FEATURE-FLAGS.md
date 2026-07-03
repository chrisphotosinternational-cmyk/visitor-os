# Feature Flags

VISITOR-OS can activate or deactivate selected modules without redeploying the application.

## Supported Flags

- `ai`
- `enrichment`
- `forecast`
- `advanced_dashboard`
- `exports`

## Storage

Flags are stored in PostgreSQL in `app_settings` under the key `feature_flags`.

Flags can be global or organization-specific.

## Admin Behavior

Administrators with settings access can update feature flags from the admin settings screen.

Disabled features must fail closed:

- The API returns `FEATURE_DISABLED` for protected feature routes.
- The dashboard avoids expensive disabled computations.
- Existing data is not deleted.

## Default Behavior

All beta flags are enabled by default to preserve existing behavior.

