# Analytics Engine

Sprint 9 adds a simple Analytics Engine for VISITOR-OS.

The goal is not complex business intelligence. The goal is to give administrators a clear view of what is happening: conversations, prospects, scoring, tags, AI usage, notifications and follow-ups.

## Scope

The engine aggregates:

- conversations
- visitors
- prospects
- lead scores
- tags
- notifications
- AI events
- follow-ups
- sites
- organizations

## Isolation

All analytics queries support:

- `organizationId`
- `siteId`
- period filters

Admin routes enforce RBAC and organization access before calling the repository.

## Periods

Supported periods:

- today
- 7 days
- 30 days
- custom

## Snapshots

The `analytics_snapshots` table stores precomputed metrics for future optimization:

- daily
- weekly
- monthly

V1 still calculates metrics live because the dataset is expected to remain small.
