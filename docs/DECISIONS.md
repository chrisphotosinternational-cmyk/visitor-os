# Technical Decisions

## Hosting

Use an external Node.js-compatible platform for the backend. Render is the preferred V1 platform.

## Database

Use PostgreSQL from V1 to avoid early migration from SQLite and to support a SaaS multi-tenant model.

## Backend

Use Node.js with TypeScript. Fastify is the preferred backend framework for the first implementation phase.

## Admin

Use Vue 3 with Vite for a simple, maintainable admin dashboard.

## Widget

Use TypeScript compiled to lightweight JavaScript without embedding React or another heavy UI framework.
