# VISITOR-OS

VISITOR-OS is a modular SaaS platform designed to become a lightweight operating system for customer relationships: visitor assistance, lead capture, qualification, CRM, analytics, notifications, exports, and future AI-powered modules.

The first integration target is Moto CMS 4. Moto CMS remains a showcase website only. VISITOR-OS is embedded through an external JavaScript widget, while all intelligence, data, administration, and automation run on an external Node.js-compatible hosting platform.

## Current Status

Development version: `v0.4.0-dev`.

The first working MVP is available:

- embeddable demo widget;
- backend message handling;
- PostgreSQL persistence;
- temporary non-AI replies;
- minimal admin dashboard;
- conversation search and status update.
- multi-tenant foundation with organizations and sites;
- configurable business engine per site.

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
- Email: Resend later
- Errors: Sentry later
- AI: OpenAI API later

## Simplified Roadmap

1. Repository and documentation foundation
2. Data model design
3. Backend skeleton
4. Admin skeleton
5. Widget skeleton
6. First conversation flow
7. Lead capture
8. CRM foundations
9. AI integration
10. Analytics, exports, and notifications

Current architecture:

```text
Organization -> Sites -> Business Configuration -> Widget -> Conversations -> Prospects
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

## Development Rule

VISITOR-OS must stay simple, modular, and maintainable by one person. Avoid unnecessary infrastructure, premature microservices, and business-specific code in the core engine.
