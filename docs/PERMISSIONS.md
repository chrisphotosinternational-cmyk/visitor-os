# Permissions

## Roles Prepared

VISITOR-OS prepares these roles:

- `SuperAdmin`
- `Admin`
- `Manager`
- `Agent`
- `Viewer`

## Current Scope

Sprint 4 does not implement authentication or permission checks.

The user model and roles exist so the next sprint can add:

- login;
- sessions;
- user organization membership;
- route-level authorization;
- role-based permissions.

## Expected Direction

Recommended future permission model:

- `SuperAdmin`: platform-wide support and maintenance.
- `Admin`: full organization management.
- `Manager`: sites, conversations, prospects and configuration.
- `Agent`: conversations and prospect follow-up.
- `Viewer`: read-only access.

