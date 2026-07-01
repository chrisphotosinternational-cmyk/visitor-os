# VISITOR-OS Data Architecture

Status: conceptual architecture, no executable schema yet.

## 1. Vision

VISITOR-OS data architecture must support a modular SaaS platform for many business activities without embedding business-specific code in the core engine.

The data model must support:

- multi-site usage;
- future multi-tenant organizations;
- anonymous visitors;
- identified prospects;
- converted customers;
- full conversation history;
- CRM follow-up;
- configurable tags and scoring;
- AI grounding and auditability;
- RGPD consent, export, and deletion;
- simple V1 analytics;
- future modules such as bookings, documents, payments, quotes, invoices, calendar events, and automations.

## 2. Core Choices

## PostgreSQL from V1

PostgreSQL is recommended from V1 because VISITOR-OS is relational by nature:

- organizations;
- sites;
- users;
- conversations;
- messages;
- prospects;
- tags;
- notes;
- follow-ups;
- privacy records.

Using PostgreSQL avoids an early migration from SQLite and gives the project a durable SaaS foundation.

## Organization-Scoped Data

Even if V1 starts with one organization, tenant-owned tables should include `organization_id`.

This reduces future migration risk and keeps authorization rules clear.

## Configuration Over Code

Business-specific differences are modeled through:

- site configs;
- module settings;
- FAQs;
- knowledge items;
- prompt templates;
- tags;
- future custom fields.

The core engine must not contain rules specific to one activity such as guest house, photographer, restaurant, lawyer, or studio.

## Append-Only Where It Matters

The following records should generally be append-only:

- messages;
- audit logs;
- privacy audit logs;
- score history;
- AI events;
- conversation events.

Corrections should be represented through new events, redaction, archive flags, or updated derived state.

## 3. Data Domains

| Domain | Purpose |
|---|---|
| Core SaaS | Organizations, users, roles, sites, modules, settings. |
| Visitor & CRM | Visitors, prospects, customers, conversations, messages, notes, follow-ups, scoring, tags. |
| AI & Knowledge | FAQs, knowledge bases, prompt templates, AI events, fallback events. |
| Tracking & Analytics | Page views, UTM events, conversion events, snapshots. |
| Notifications | Notification and email event history. |
| Exports | Export jobs and generated file metadata. |
| Privacy | Consents, data export requests, deletion requests, privacy audit logs. |
| System | App settings, audit logs, error logs, webhooks. |
| Future Modules | Bookings, payments, invoices, quotes, documents, calendar, automations. |

## 4. Privacy and RGPD Strategy

VISITOR-OS must support privacy operations from the start.

Principles:

- collect only useful data;
- track consent by purpose;
- verify identity before export/deletion;
- anonymize instead of deleting where aggregate statistics must remain;
- expire generated export files;
- log privacy operations separately from general audit logs;
- avoid raw IP storage when hashed/truncated data is enough.

## 5. Analytics Strategy

V1 analytics should remain light.

Recommended V1 approach:

- use operational tables for simple counts;
- create `analytics_snapshots` for daily/weekly summaries when needed;
- avoid a separate analytics warehouse;
- preserve anonymous aggregate metrics after privacy deletion.

Tracked metrics:

- conversations per day;
- prospects created;
- conversion rate;
- frequent tags;
- average score;
- high-performing sites;
- common questions;
- fallback rate;
- estimated AI cost;
- notifications sent;
- overdue follow-ups.

## 6. AI Data Strategy

AI must be traceable without storing unnecessary sensitive data.

Recommended:

- store prompt template version;
- store provider/model;
- store token and cost estimates;
- store summarized input/output where possible;
- store fallback events when the AI cannot answer safely;
- use FAQs and knowledge items as validated context;
- avoid storing full raw prompts if they contain personal data.

## 7. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Cross-tenant leakage | Critical | `organization_id` everywhere, scoped queries, authorization tests. |
| Over-complex model | Medium | Keep V1 modules minimal; add future modules only when needed. |
| RGPD deletion breaking stats | High | Anonymize personal records while retaining aggregate snapshots. |
| Duplicate prospects | Medium | Normalize email/phone, require manual review for uncertain merges. |
| Sensitive logs | High | Separate logs, redact payloads, avoid secrets and full personal data. |
| Stale configurations | Medium | Version `site_configs`, record config version on conversations. |
| AI hallucination | High | FAQs, knowledge base, fallback events, prompt versions. |

## 8. Recommendations

- Keep PostgreSQL as the V1 database.
- Include `organization_id` from the start.
- Build the model around conversations, prospects, and configurations first.
- Keep analytics simple until volume proves a need.
- Treat RGPD export/deletion as core data design, not a later add-on.
- Do not create booking, payment, invoice, document, or automation tables until the product needs them.
- Keep future modules documented but inactive.
