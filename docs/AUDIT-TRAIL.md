# Audit Trail

The audit trail records important administrative and business actions.

## Recorded Fields

Each entry contains:

- `id`
- `organization_id`
- `user_id`
- `ip`
- `user_agent`
- `trace_id`
- `action`
- `resource`
- `resource_id`
- `before`
- `after`
- `created_at`

## Actions To Record

The audit trail is designed to cover:

- Login
- Logout
- Prospect creation
- Prospect update
- Prospect deletion
- Import
- Export
- AI analysis
- Suggestion acceptance
- Pipeline modification
- User creation
- Permission changes

## Safety Rule

Audit failures must never break a user workflow. If the audit table is unavailable, the product action continues and the operational error can be inspected through logs.

## Multi-Tenant Rule

Every audit entry should include `organization_id` whenever the action belongs to an organization. SuperAdmin global actions may have a null organization.

