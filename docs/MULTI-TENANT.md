# Multi-Tenant Foundation

## Goal

VISITOR-OS can now prepare multiple independent organizations in one application instance.

## Relationship Model

```text
Organization
  -> Users
  -> Sites
    -> Business Configuration
    -> Visitors
    -> Conversations
    -> Prospects
    -> Messages
```

## Isolation

Core tables already include `organization_id`:

- visitors
- conversations
- messages
- prospects
- decision events

Admin list endpoints accept `organizationId` filters where needed. This prepares tenant isolation before full authentication exists.

## Current Limitation

There is no authentication yet, so organization isolation is prepared at data and repository level but not enforced by logged-in user sessions.

Sprint 5 should add authentication or an admin access boundary before any public production use.

