# VISITOR-OS

VISITOR-OS is a modular SaaS platform designed to become a lightweight operating system for customer relationships: visitor assistance, lead capture, qualification, CRM, analytics, notifications, exports, and future AI-powered modules.

The first integration target is Moto CMS 4. Moto CMS remains a showcase website only. VISITOR-OS is embedded through an external JavaScript widget, while all intelligence, data, administration, and automation run on an external Node.js-compatible hosting platform.

## Current Status

Repository initialized. No business feature is implemented yet.

This phase defines the project structure, documentation areas, configuration examples, and future development boundaries.

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

## Development Rule

VISITOR-OS must stay simple, modular, and maintainable by one person. Avoid unnecessary infrastructure, premature microservices, and business-specific code in the core engine.
