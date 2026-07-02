# VISITOR-OS Backend

Technical foundation for the VISITOR-OS backend.

This package now contains the first minimal vertical slice:

- widget conversation creation;
- temporary backend reply;
- conversation/message persistence;
- automatic prospect creation;
- admin conversation listing and search;
- admin conversation detail with full message history;
- conversation status update;
- admin prospect listing;
- prospect detail with conversation history;
- prospect status update.
- admin authentication, sessions and RBAC;
- AI Provider Engine with mock/OpenAI abstraction and fallback.
- advanced CRM with scoring, tags, notes, follow-ups and exports.
- central Notification Engine with internal, email and webhook providers.
- Analytics Engine with KPI dashboard, exports and snapshot foundation.
- Knowledge Management System with document import, search, versioning and RAG-ready interfaces.
- Document Intelligence RC2 with real file extraction, configurable chunking and indexing queue.

It still contains no payments, bookings or business-specific hardcoded logic.

## Stack

- Node.js
- TypeScript
- Fastify
- PostgreSQL via `pg`
- Zod for environment validation
- ESLint
- Prettier
- Node.js native test runner

## Requirements

- Node.js 22 or newer
- pnpm
- PostgreSQL database available for real startup

## Installation

```bash
cd backend
pnpm install
```

## Configuration

Copy the example environment file:

```bash
cp .env.example .env
```

Required variable:

- `DATABASE_URL`: PostgreSQL connection string.

Useful variables:

- `NODE_ENV`
- `APP_NAME`
- `HOST`
- `PORT`
- `LOG_LEVEL`
- `DATABASE_SSL`
- `DATABASE_CONNECTION_TIMEOUT_MS`
- `ALLOWED_ORIGINS`
- `SHUTDOWN_TIMEOUT_MS`
- `OPENAI_API_KEY` optional. If absent, OpenAI requests automatically fall back to the mock provider.
- `RESEND_API_KEY` optional. If absent, email notifications use the mock provider.
- `NOTIFICATION_FROM_EMAIL`, `NOTIFICATION_RETRY_ATTEMPTS`, `NOTIFICATION_TIMEOUT_MS`.
- `BUSINESS_CONFIG_DIR` defaults to `../configs`.
- `ADMIN_SESSION_SECRET`, `ADMIN_SESSION_TTL_MS`, `ADMIN_SESSION_RENEWAL_MS`.
- `FIRST_ADMIN_EMAIL` and `FIRST_ADMIN_PASSWORD` can bootstrap the first admin user.

The backend validates configuration at startup and fails fast when required variables are missing or invalid.

## Development

```bash
pnpm dev
```

The application validates configuration, checks PostgreSQL connectivity, then starts the Fastify server.

## Five-Minute Local Run

1. Install dependencies:

   ```bash
   cd backend
   pnpm install
   ```

2. Configure PostgreSQL:

   ```bash
   cp .env.example .env
   ```

3. Edit `DATABASE_URL` in `.env`.

4. Validate the backend:

   ```bash
   pnpm check
   ```

5. Start:

   ```bash
   pnpm dev
   ```

The app initializes the minimal schema and demo site at startup.

## Production Start

```bash
pnpm build
pnpm start
```

## Tests

```bash
pnpm test
```

The test suite verifies:

- configuration loading;
- invalid configuration handling;
- application startup shell;
- technical health route;
- database startup check contract.
- full MVP visitor-to-admin flow.
- admin authentication, sessions, RBAC and organization isolation.
- AI provider abstraction, mock fallback, OpenAI adapter and cost estimation.
- CRM scoring, tag detection and export formatting.
- Notification Engine templates, mock email, webhook abstraction and retry behavior.
- Analytics calculations, period filters, exports and snapshots.
- KMS validation, file extraction, indexing, search, versioning and Decision Engine priority.

An optional PostgreSQL integration test runs when `TEST_DATABASE_URL` is provided:

```bash
TEST_DATABASE_URL=postgresql://user:password@localhost:5432/visitor_os pnpm test
```

## Quality Checks

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm build
```

Or run everything:

```bash
pnpm check
```

## Structure

```text
src/
  app.ts
  main.ts
  common/
  core/
    config/
    errors/
    lifecycle/
    logger/
  database/
  middlewares/
  modules/
  shared/
  types/
  utils/
tests/
```

## Current Routes

- `GET /health`: technical health check only.
- `GET /live`: liveness probe without external dependency.
- `GET /ready`: readiness probe with PostgreSQL connectivity check.
- `GET /api/widget/config`
- `POST /api/widget/conversations`
- `POST /api/widget/conversations/:conversationId/messages`
- `GET /api/admin/conversations`
- `GET /api/admin/conversations/:conversationId`
- `PATCH /api/admin/conversations/:conversationId/status`
- `GET /api/admin/prospects`
- `GET /api/admin/prospects/export`
- `GET /api/admin/prospects/:prospectId`
- `PATCH /api/admin/prospects/:prospectId/status`
- `POST /api/admin/prospects/:prospectId/recalculate-score`
- `POST /api/admin/prospects/:prospectId/tags`
- `DELETE /api/admin/prospects/:prospectId/tags/:tagId`
- `GET /api/admin/crm/tags`
- `POST /api/admin/crm/notes`
- `PUT /api/admin/crm/notes/:noteId`
- `DELETE /api/admin/crm/notes/:noteId`
- `GET /api/admin/crm/follow-ups`
- `POST /api/admin/crm/follow-ups`
- `PATCH /api/admin/crm/follow-ups/:followUpId/complete`
- `GET /api/admin/ai/config`
- `PUT /api/admin/ai/config`
- `POST /api/admin/ai/test`
- `GET /api/admin/notifications`
- `GET /api/admin/notifications/settings`
- `PUT /api/admin/notifications/settings`
- `POST /api/admin/notifications/test`
- `GET /api/admin/analytics`
- `GET /api/admin/analytics/export`
- `POST /api/admin/analytics/snapshots`
- `GET /api/admin/knowledge`
- `POST /api/admin/knowledge/import`
- `POST /api/admin/knowledge/import-file`
- `GET /api/admin/knowledge/search`
- `GET /api/admin/knowledge/:documentId/versions`
- `PATCH /api/admin/knowledge/:documentId/archive`
- `DELETE /api/admin/knowledge/:documentId`

The widget/admin routes are intentionally minimal and exist only to validate the product flow.

## Security Notes

- Zod validation errors return `400 VALIDATION_ERROR`.
- Production requires explicit `ALLOWED_ORIGINS`.
- Basic security headers are sent on responses.
- A simple in-memory rate limiter protects the MVP.
- If `OPENAI_API_KEY` is absent, the decision engine uses the mock AI provider and does not call external services.
- Admin routes are protected by signed httpOnly sessions and RBAC.

## Conversational Decision Engine

The widget message flow is now:

```text
visitor message -> decision engine -> assistant reply -> persisted decision metadata
```

Decision priority:

1. human escalation for sensitive requests;
2. FAQ local match;
3. document Knowledge Search;
4. knowledge base match;
5. AI provider abstraction with provider factory and fallback;
6. fallback.

The admin conversation detail shows the response source, confidence, escalation flag and processing time for assistant messages.

## AI Provider Engine

The Decision Engine depends only on the `AIProvider` interface. Providers receive a generated
system prompt, conversation context and normalized configuration. They do not build prompts.

Supported architecture:

- `MockAIProvider`: zero-cost test provider.
- `OpenAIProvider`: real adapter, active only when `OPENAI_API_KEY` is configured.
- `PreparedProvider`: Anthropic, Mistral and Ollama placeholders ready for future implementation.
- `ProviderFactory`: selects the configured provider and falls back to mock when a provider is unavailable.

AI events are persisted with provider, model, latency, input tokens, output tokens and estimated cost.

## Knowledge Management System

RC2 adds Document Intelligence while keeping the KMS self-contained.

Supported file imports:

- PDF
- DOCX
- TXT
- Markdown
- HTML
- CSV
- JSON

The importer extracts text, preserves basic metadata, versions repeated file imports, chunks content with configurable limits and stores searchable tokens in PostgreSQL. The indexing queue is synchronous in RC2, but isolated behind a service so it can move to an async worker later.

No embeddings, vector database or RAG generation is active in RC2.

## Notification Engine

All outgoing communication goes through the Notification Engine.

Providers:

- `InternalProvider`
- `MockEmailProvider`
- `ResendEmailProvider`
- `WebhookProvider`

The engine resolves templates, organization settings, retry attempts, provider execution and history. It stores notification status without persisting full sensitive message bodies. The current queue is synchronous but behind an interface for future worker migration.

## Business Configuration Engine

The backend now loads active JSON configurations from `BUSINESS_CONFIG_DIR`.

Admin routes:

- `GET /api/admin/configs`
- `GET /api/admin/configs/:configId`
- `PUT /api/admin/configs/:configId`
- `POST /api/admin/configs/import`
- `POST /api/admin/configs/reload`
- `GET /api/admin/configs/:configId/export`

The Decision Engine uses configuration data for business rules, FAQ, knowledge base and fallback behavior.

## Multi-Tenant Foundation

Sprint 4 adds prepared SaaS entities:

- organizations;
- sites;
- users and roles.

Admin routes:

- `GET /api/admin/organizations`
- `POST /api/admin/organizations`
- `GET /api/admin/organizations/:organizationId`
- `PUT /api/admin/organizations/:organizationId`
- `PATCH /api/admin/organizations/:organizationId/status`
- `DELETE /api/admin/organizations/:organizationId`
- `GET /api/admin/sites`
- `POST /api/admin/sites`
- `GET /api/admin/sites/:siteId`
- `PUT /api/admin/sites/:siteId`
- `PATCH /api/admin/sites/:siteId/status`
- `DELETE /api/admin/sites/:siteId`

The widget accepts `siteId`, `siteSlug` or `siteKey` and loads the associated business configuration.

## Admin Authentication

Sprint 5 protects admin routes with signed httpOnly sessions.

Auth routes:

- `POST /api/admin/auth/login`
- `POST /api/admin/auth/logout`
- `GET /api/admin/auth/me`

Environment variables:

- `ADMIN_SESSION_SECRET`
- `ADMIN_SESSION_TTL_MS`
- `ADMIN_SESSION_RENEWAL_MS`
- `FIRST_ADMIN_EMAIL`
- `FIRST_ADMIN_PASSWORD`
- `FIRST_ADMIN_FIRST_NAME`
- `FIRST_ADMIN_LAST_NAME`
- `FIRST_ADMIN_ORGANIZATION_ID`

Passwords are hashed with bcrypt. Session tokens are signed in cookies and stored as hashes server-side.

## PostgreSQL

The startup process calls a PostgreSQL connection check before listening for requests.

If PostgreSQL is unreachable, the backend fails to start instead of running in a degraded unclear state.

The `/ready` endpoint also checks PostgreSQL connectivity for production orchestration and reverse proxy checks.

The backend also initializes the minimal MVP schema and seeds a demo organization/site with:

```text
siteKey: demo-site-key
```

## Logging

Fastify/Pino logging is configured through `LOG_LEVEL`.

Future integrations such as Sentry must not replace business audit logs or privacy audit logs.

## Error Handling

The backend includes a global error handler that returns stable error payloads and logs internal details server-side.

## Deployment

The V1 target platform remains Render or another Node.js-compatible managed platform.

Docker is not included in this foundation because the validated V1 architecture does not require it.
