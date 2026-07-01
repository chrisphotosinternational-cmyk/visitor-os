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

It still contains no chatbot AI, no authentication, no advanced CRM, and no business-specific logic.

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
- `GET /api/widget/config`
- `POST /api/widget/conversations`
- `POST /api/widget/conversations/:conversationId/messages`
- `GET /api/admin/conversations`
- `GET /api/admin/conversations/:conversationId`
- `PATCH /api/admin/conversations/:conversationId/status`
- `GET /api/admin/prospects`
- `GET /api/admin/prospects/:prospectId`
- `PATCH /api/admin/prospects/:prospectId/status`

The widget/admin routes are intentionally minimal and exist only to validate the first product flow.

## Security Notes

- Zod validation errors return `400 VALIDATION_ERROR`.
- Production requires explicit `ALLOWED_ORIGINS`.
- Basic security headers are sent on responses.
- A simple in-memory rate limiter protects the MVP.
- Authentication is intentionally not present yet and must be added before public production usage.

## PostgreSQL

The startup process calls a PostgreSQL connection check before listening for requests.

If PostgreSQL is unreachable, the backend fails to start instead of running in a degraded unclear state.

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
