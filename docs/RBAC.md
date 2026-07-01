# RBAC

## Roles

- `SuperAdmin`
- `Admin`
- `Manager`
- `Agent`
- `Viewer`

## Permissions

- `organizations:read`
- `organizations:write`
- `sites:read`
- `sites:write`
- `conversations:read`
- `conversations:write`
- `prospects:read`
- `prospects:write`
- `data:export`
- `settings:access`

## Organization Isolation

Non-SuperAdmin users are restricted to their own `organizationId`.

`SuperAdmin` can access every organization.

## Current Limits

RBAC is backend-enforced for admin routes. The frontend hides unavailable actions, but the backend remains the authority.

