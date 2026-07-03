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

## Development Rule

VISITOR-OS must stay simple, modular, and maintainable by one person. Avoid unnecessary infrastructure, premature microservices, and business-specific code in the core engine.
