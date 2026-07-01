# Future Migrations

Status: conceptual migration strategy, no executable migration yet.

## 1. Guiding Principles

- Avoid early migrations by choosing PostgreSQL from V1.
- Keep the schema modular and organization-scoped from the beginning.
- Add optional modules through new tables and module settings, not by changing core assumptions.
- Prefer additive migrations.
- Avoid destructive migrations without tested backups and rollback plans.
- Keep data export and anonymization paths available during migration.

## 2. V1 to V2 Migration Strategy

V1 focus:

- organizations
- users
- sites
- site configs
- visitors
- conversations
- messages
- prospects
- tags
- notes
- follow-ups
- exports
- basic logs
- basic consents

V2 additions:

- richer scoring rules;
- advanced analytics snapshots;
- notification preferences;
- knowledge bases and document import;
- prompt template versioning;
- AI cost reporting;
- roles and permissions beyond basic owner/admin;
- custom fields.

Migration approach:

- Add tables rather than overloading JSON columns.
- Backfill derived fields from existing messages/conversations where needed.
- Keep old fields until admin and backend stop using them.
- Add indexes after measuring query patterns.

## 3. Mono-Organization to Multi-Tenant

Even if V1 starts with one organization, tables should include `organization_id` from day one.

If V1 accidentally starts without full multi-tenant enforcement, migration must:

1. Create a default organization.
2. Backfill `organization_id` on all tenant-owned records.
3. Add not-null constraints after backfill.
4. Add organization-scoped indexes.
5. Update service-level query filters.
6. Add authorization tests.
7. Add unique constraints scoped by organization where needed.

Risk:

- Cross-tenant leakage is the highest-risk migration. Avoid it by including `organization_id` from V1.

## 4. SQLite to PostgreSQL

This migration should be avoided for VISITOR-OS production.

If a prototype ever uses SQLite:

1. Freeze writes.
2. Export all tables.
3. Create PostgreSQL schema.
4. Normalize data types.
5. Import and verify row counts.
6. Rebuild indexes.
7. Validate relations.
8. Run privacy/export checks.

Recommendation:

- Use PostgreSQL from V1 to avoid this migration.

## 5. Analytics Evolution

V1:

- Query operational tables.
- Add simple snapshots for daily metrics.

V2:

- Expand `analytics_snapshots`.
- Track fallback rates, score averages, source performance, notification outcomes.

V3:

- Consider a separate analytics store only if PostgreSQL queries become expensive.
- Keep personal identifiers out of long-term analytics.

## 6. Knowledge and AI Evolution

V1:

- FAQ and simple knowledge items.
- AI events store summaries and cost data.

V2:

- Document import.
- Knowledge item versioning.
- Prompt template versioning.
- Fallback-to-FAQ improvement workflow.

V3:

- Vector index references.
- Citation tracking.
- Model evaluation.
- Per-activity scoring and prompt profiles.

Migration caution:

- Do not store large documents or embeddings inside core operational tables unless there is a clear strategy.

## 7. Future Module Additions

## Bookings

Add when reservation workflow is validated.

Likely tables:

- bookings
- availability_rules
- booking_events

Relationships:

- organization/site/prospect/customer/calendar_event.

## Payments

Add only when monetized flows require payment.

Likely tables:

- payments
- payment_events
- provider_customers

Rule:

- Never store card data.

## Quotes and Invoices

Add when service businesses need proposal and billing flows.

Likely tables:

- quotes
- quote_items
- invoices
- invoice_items

Rule:

- Legal numbering and retention must be designed before release.

## Documents

Add when file upload or generated documents are needed.

Likely tables:

- documents
- document_versions
- document_links

Rule:

- Use object storage such as S3/R2/Supabase Storage, not PostgreSQL blobs.

## Calendar Events

Add when follow-ups/bookings need calendar views.

Likely tables:

- calendar_events
- calendar_integrations

Rule:

- Timezone handling must be explicit.

## Automations

Add only after manual workflows are understood.

Likely tables:

- automation_rules
- automation_runs
- automation_actions

Rule:

- Avoid building a general workflow engine before product-market fit.

## 8. Data Retention Migration

Future retention jobs should:

- anonymize old visitors;
- archive inactive prospects;
- delete expired export files;
- purge old error logs;
- keep aggregate analytics;
- preserve privacy audit logs.

Migration caution:

- Retention jobs must be idempotent and logged.

## 9. Backup and Rollback Requirements

Before any production migration:

- Confirm recent database backup.
- Confirm restore procedure.
- Run migration on staging data.
- Document rollback or forward-fix strategy.
- Avoid schema changes that require long locks if data volume grows.

## 10. Recommended Migration Phases

| Phase | Migration theme | Goal |
|---|---|---|
| V1 | Core operational model | Conversations, prospects, configs, exports, basic privacy. |
| V1.1 | Usability | Notes, follow-ups, tags, better exports. |
| V2 | Intelligence | Knowledge, AI events, scoring history, analytics snapshots. |
| V2.5 | SaaS maturity | Roles, permissions, quotas, module settings. |
| V3 | Business modules | Bookings, documents, quotes, payments, automations. |
