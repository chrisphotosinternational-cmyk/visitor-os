# VISITOR-OS

VISITOR-OS is a modular SaaS platform designed to become a lightweight operating system for customer relationships: visitor assistance, lead capture, qualification, CRM, analytics, notifications, exports, and future AI-powered modules.

The first integration target is Moto CMS 4. Moto CMS remains a showcase website only. VISITOR-OS is embedded through an external JavaScript widget, while all intelligence, data, administration, and automation run on an external Node.js-compatible SaaS platform such as Render, Railway, Fly.io, or DigitalOcean App Platform.

## Current Status

Development version: `v0.12.0-beta-prep`.

The first working MVP is available:

- embeddable demo widget;
- backend message handling;
- PostgreSQL persistence;
- temporary non-AI replies;
- minimal admin dashboard;
- conversation search and status update.
- multi-tenant foundation with organizations and sites;
- configurable business engine per site.
- protected admin authentication and RBAC.
- organizations, users, and prospects administration through the production admin UI.
- contact history, manual follow-ups, and prospect timeline for commercial tracking.
- message templates and manual outreach assistant with copy-only workflow.
- AI Provider Engine with mock fallback and OpenAI-ready abstraction.
- advanced CRM foundation with scoring, tags, notes, follow-ups and exports.
- Notification Engine with internal alerts, email mock/Resend provider, webhooks and history.
- Analytics Engine with KPI dashboard, reporting exports and snapshot foundation.
- Knowledge Management System with document import, search, versioning and RAG-ready interfaces.
- Document Intelligence RC2 with real file extraction, configurable chunking and indexing queue.
- Production deployment preparation with external SaaS guidance, health checks and backup/restore runbooks.
- External SaaS deployment guidance for Render/Railway with managed PostgreSQL.

## Planned Modules

- Lightweight JavaScript widget
- AI assistant module
- Conversation tracking
- Lead capture
- Mini CRM
- Tags, notes, reminders, and scoring
- Manual message templates and outreach history
- Statistics and exports
- Notifications
- Configuration by business activity
- Multi-organization and multi-site administration
- Future calendar, bookings, payments, documents, and automations

## Moto CMS 4 Constraint

- No backend is installed on Moto CMS.
- No FTP/server dependency is required on Moto CMS.
- Integration is done through a simple external script tag.
- The widget communicates with the VISITOR-OS API hosted externally.
- Moto CMS remains a public website, not an application server.

## Planned Technology Stack

- Backend: Node.js, TypeScript, Fastify
- Admin: Vue 3, Vite, TypeScript
- Widget: lightweight TypeScript compiled to JavaScript
- Database: PostgreSQL
- Hosting: Render for V1, Railway as an alternative
- Email: Resend-ready through Notification Engine, mock by default
- Errors: Sentry later
- AI: provider abstraction with Mock and OpenAI-ready provider

## Simplified Roadmap

1. Repository and documentation foundation
2. Data model design
3. Backend skeleton
4. Admin skeleton
5. Widget skeleton
6. First conversation flow
7. Lead capture
8. CRM foundations
9. AI provider integration
10. Notifications
11. Analytics
12. Knowledge Management System
13. Document Intelligence
14. Production deployment preparation
15. Future automations

Current architecture:

```text
Organization -> Sites -> Business Configuration -> Knowledge -> Widget -> Conversations -> Prospects
```

## Quick Start

Backend:

```bash
cd backend
pnpm install
cp .env.example .env
pnpm check
pnpm dev
```

The backend requires a PostgreSQL database configured through `DATABASE_URL`.

Widget demo:

```bash
cd widget
python3 -m http.server 4173
```

Open `http://localhost:4173/demo.html`.

Admin demo:

```bash
cd frontend-admin
python3 -m http.server 5173
```

Open `http://localhost:5173`.

External SaaS production preparation:

```bash
open deployment/RENDER.md
open deployment/RAILWAY.md
```

Docker Compose files are kept for local validation/reference, not for OVH Web mutualise.

## CRM Prospects Core

Sprint 6 introduces the first production CRM layer for public prospect management.

Admin routes are protected by JWT and RBAC under `/admin-api/prospects`. The admin interface exposes:

- `/prospects` for list, search, filters, CSV export;
- `/prospects/new` for manual creation;
- `/prospects/:id` for editing;
- `/prospects/import` for CSV import.

Prospects are always scoped by `organization_id`. SuperAdmin can filter globally; Admin, Manager, Agent, and Viewer remain limited to their organization according to their permissions.

Expected CRM fields:

- identity: `first_name`, `last_name`, `pseudo`, `company`;
- contact: `email`, `phone`, `website`;
- social/platforms: `instagram`, `twitter_x`, `mym`, `onlyfans`, `linktree`, `allmylinks`;
- qualification: `city`, `activity`, `description`, `source_url`, `status`, `notes`;
- scoring: `score`, `score_label`.

Statuses:

```text
new, to_qualify, to_contact, contacted, interested, refused,
follow_up, potential_client, signed_client, blacklist
```

Scoring is deliberately simple and explainable:

- city: +10;
- email: +15;
- phone: +15;
- Instagram or Twitter/X: +10;
- MYM or OnlyFans: +20;
- website, portfolio, Linktree, or AllMyLinks: +10;
- coherent description: +10;
- no contact method: -25;
- probable duplicate during import: merged instead of blindly created.

Score labels:

```text
80-100 very_high
60-79  high
40-59  medium
20-39  low
0-19   ignore
```

CSV import accepts the same field names. Deduplication is performed by email, phone, source URL, then pseudo + city. Existing prospects are not deleted: missing fields are merged and the most complete text value is preserved.

CSV export returns the filtered prospect list.

Compliance limits:

- VISITOR-OS does not send automatic prospect outreach in this sprint.
- VISITOR-OS must only store data the administrator is allowed to process.
- No private account access, scraping bypass, or hidden data collection is part of the product.
- Public data imports remain the responsibility of the administrator and must respect applicable laws and platform terms.

## Contact History And Follow-Ups

Sprint 7 adds manual commercial tracking to the prospect CRM.

Each prospect can now have a structured contact timeline:

- contact date;
- manual channel;
- message used;
- prospect response;
- outcome;
- next action;
- follow-up date;
- internal notes.

Supported manual channels:

```text
email, phone, whatsapp_manual, instagram_manual, x_manual,
mym_manual, onlyfans_manual, website_form, other
```

Supported outcomes:

```text
no_response, positive, negative, interested, not_now,
booked, blacklist, follow_up_needed
```

Automatic prospect status updates:

- `follow_up_date` present -> `follow_up`;
- `blacklist` outcome -> `blacklist`;
- `booked` outcome -> `signed_client`;
- `interested` or `positive` outcome -> `interested`;
- `negative` outcome -> `refused`;
- `follow_up_needed` outcome -> `follow_up`.

Admin routes are protected by JWT/RBAC:

- `GET /admin-api/prospects/:id/history`;
- `POST /admin-api/prospects/:id/history`;
- `PATCH /admin-api/contact-history/:id`;
- `DELETE /admin-api/contact-history/:id`;
- `GET /admin-api/contact-history/follow-ups`;
- `GET /admin-api/contact-history/export-csv`.

The admin interface exposes:

- timeline inside `/prospects/:id`;
- manual interaction form;
- `/follow-ups` page for upcoming and overdue reminders;
- CSV export for follow-ups/history.

Compliance limits:

- no automatic email, WhatsApp, Instagram, MYM, OnlyFans, or X sending;
- VISITOR-OS only records manual contact actions done outside the system;
- no private account access or automated platform interaction is included;
- the operator remains responsible for lawful and proportionate prospecting.

## Message Templates And Manual Outreach

Sprint 8 adds a manual outreach assistant. It helps an administrator prepare personalized messages, copy them, and store the final message in the prospect timeline.

It never sends messages automatically.

Admin routes are protected by JWT/RBAC:

- `GET /admin-api/message-templates`;
- `GET /admin-api/message-templates/:id`;
- `POST /admin-api/message-templates`;
- `PATCH /admin-api/message-templates/:id`;
- `DELETE /admin-api/message-templates/:id`;
- `POST /admin-api/message-templates/:id/render`;
- `POST /admin-api/prospects/:id/render-message`;
- `POST /admin-api/prospects/:id/save-rendered-message`;
- `GET /admin-api/message-templates/export-csv`;
- `GET /admin-api/message-templates/usage-csv`.

Supported channels:

```text
email, phone_script, whatsapp_manual, instagram_manual, x_manual,
mym_manual, onlyfans_manual, website_form, other
```

Supported purposes:

```text
first_contact, follow_up, proposal, reactivation,
thank_you, refusal_response, custom
```

Supported variables:

```text
{first_name}, {last_name}, {pseudo}, {city}, {activity}, {platform},
{website}, {instagram}, {mym}, {onlyfans}, {score_label}
```

Missing values are rendered as empty text. This keeps messages clean and avoids exposing placeholders to prospects.

Default templates are created per organization when templates are first loaded. They are intentionally short, professional, respectful, and non-intrusive.

The admin interface exposes:

- `/message-templates` for listing and exporting templates;
- `/message-templates/new` for creation;
- `/message-templates/:id` for editing;
- a Messages block inside `/prospects/:id` for preview, copy, and history save.

Usage tracking records copies and history saves. It does not record any automatic send event because no send feature exists in this sprint.

## AI Qualification Engine

Sprint 9 adds a deterministic AI qualification layer for prospects. It analyzes the public CRM data already stored for a prospect and generates a commercial reading that can be reused by the administrator.

The engine returns:

- a concise summary;
- strengths;
- weaknesses;
- opportunities;
- risks;
- a commercial opportunity;
- a recommended offer;
- a priority;
- a confidence score from 0 to 100.

Recommended offers are intentionally explainable:

```text
Shooting decouverte, Shooting premium, Creation de contenu,
Pack MYM, Pack OnlyFans, Portrait professionnel,
Publicite, Collaboration artistique
```

Admin routes are protected by JWT/RBAC:

- `POST /admin-api/prospects/:id/analyze`;
- `GET /admin-api/prospects/:id/analysis`;
- `POST /admin-api/prospects/analyze-batch`;
- `GET /admin-api/prospects/analyze-batch/:jobId`.

Each analysis is stored in PostgreSQL in `prospect_ai_analysis`. Recalculation creates a new historical record instead of overwriting the previous one.

The batch engine is intentionally simple in this sprint: it runs asynchronously in memory and exposes progress through a job id. It is ready to move later to a persistent queue if volume requires it.

The admin interface exposes:

- an `AI Analysis` block inside the prospect detail page;
- a recalculation button;
- batch analysis trigger;
- dashboard metrics for analyzed prospects, pending analyses, average confidence and priority opportunities;
- a top prospects AI table.

Limits:

- no external AI provider is required for this sprint;
- no automatic outreach is sent;
- the analysis is a decision-support signal, not an automatic commercial decision;
- the administrator remains responsible for checking the data and using it lawfully.

## Public Profile Enrichment

Sprint 10 adds a public-only enrichment layer for prospects. It uses URLs already stored on a prospect record and extracts only information that is visible without authentication.

Supported sources:

```text
website, instagram_public, x_public, linktree, allmylinks,
mym_public, onlyfans_public, other
```

The enrichment engine can detect:

- page title and meta description;
- visible email addresses;
- visible phone numbers;
- public social links;
- public platforms;
- possible location and activity;
- a short extracted summary;
- a confidence score from 0 to 100.

Admin routes are protected by JWT/RBAC:

- `POST /admin-api/prospects/:id/enrich`;
- `GET /admin-api/prospects/:id/enrichments`;
- `POST /admin-api/prospects/enrich-batch`;
- `GET /admin-api/prospects/enrich-batch/:jobId`;
- `GET /admin-api/enrichments`;
- `GET /admin-api/enrichments/:id`;
- `DELETE /admin-api/enrichments/:id`;
- `GET /admin-api/prospects/:id/suggestions`;
- `POST /admin-api/prospects/:id/suggestions/:suggestionId/accept`;
- `POST /admin-api/prospects/:id/suggestions/:suggestionId/reject`.

Enrichment never overwrites a prospect automatically. Detected values are stored as field suggestions with a `pending`, `accepted`, or `rejected` status. A human administrator must explicitly accept a suggestion before the prospect record is updated.

Batch enrichment is available for:

- selected prospects;
- prospects with public URLs;
- high-score prospects;
- prospects with URLs but missing contact data.

Operational safeguards:

- configurable request timeout;
- configurable maximum public pages per prospect;
- explicit VISITOR-OS user agent;
- simple per-organization batch control;
- blocked status for login, account, checkout, captcha, paywall, 401, 403, or 429 responses.

Compliance limits:

- no login;
- no captcha solving;
- no paywall bypass;
- no private account access;
- no aggressive scraping;
- no automatic outreach;
- no automatic AI recalculation after enrichment.

When a suggestion is accepted, the prospect can be marked as needing a fresh AI analysis. The recalculation remains a manual user action.

## Sales Pipeline And Conversion Metrics

Sprint 11 turns the CRM into a commercial steering tool. The pipeline is based on the existing prospect statuses and does not create a separate sales model.

Pipeline stages:

```text
new, to_qualify, to_contact, contacted, follow_up,
interested, potential_client, signed_client, refused, blacklist
```

Admin routes are protected by JWT/RBAC:

- `GET /admin-api/pipeline`;
- `GET /admin-api/pipeline/metrics`;
- `PATCH /admin-api/prospects/:id/pipeline-stage`;
- `GET /admin-api/pipeline/forecast`;
- `GET /admin-api/pipeline/activity`.

Pipeline filters:

- city;
- score label;
- source;
- platform;
- user;
- sort by score, follow-up date, or creation date.

Conversion metrics are intentionally simple and explainable:

- prospects by stage;
- contacted to interested rate;
- interested to signed client rate;
- global new to signed client rate;
- prospects stalled without action;
- overdue follow-ups;
- prospects never contacted;
- top cities by potential;
- top platforms by potential.

Forecast configuration:

```text
averageDealValue
lowConversionRate
mediumConversionRate
highConversionRate
```

The forecast estimates low, medium, and high potential revenue from high-priority uncontacted prospects, interested prospects, and potential clients. It is a planning indicator, not an accounting forecast.

CRM activity is stored in `crm_activity_log` for events such as:

- prospect created;
- pipeline stage changed;
- contact history added;
- suggestion accepted;
- AI analysis recalculated;
- enrichment succeeded;
- prospect signed;
- prospect blacklisted.

Limits:

- no automatic outreach;
- no automatic status progression outside explicit user actions and existing contact-history rules;
- no predictive analytics;
- forecast values must be configured and interpreted by the administrator.

## Development Rule

VISITOR-OS must stay simple, modular, and maintainable by one person. Avoid unnecessary infrastructure, premature microservices, and business-specific code in the core engine.
