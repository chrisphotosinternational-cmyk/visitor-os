# Backend Changelog

## Unreleased

- Added advanced CRM scoring, tags, notes, follow-ups and exports.
- Added CRM schema tables for score history, tags, notes and follow-ups.
- Added CRM admin endpoints protected by RBAC and organization isolation.
- Added AI Provider Engine with mock, OpenAI-ready adapter, provider factory and fallback.
- Added AI configuration and AI event database tables.
- Added admin AI configuration and provider test routes.
- Added AI provider, fallback and cost estimation tests.
- Added first minimal visitor-to-admin vertical slice.
- Added widget routes for conversation start and message send.
- Added admin conversation list, detail, search, and status update routes.
- Added admin routes for prospect list, detail, and status update.
- Added PostgreSQL schema initialization and demo seed data.
- Added repository layer for conversations and prospects.
- Added end-to-end backend test for the full MVP visitor/admin flow.
- Initialized backend TypeScript foundation.
- Added environment validation.
- Added PostgreSQL connection foundation.
- Added Fastify application shell with technical health route.
- Added global error handling.
- Added logging foundation.
- Added native Node.js test, lint, format, build, and start scripts.
