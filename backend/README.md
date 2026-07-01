# VISITOR-OS Backend

Technical foundation for the VISITOR-OS backend.

This package intentionally contains no business feature yet: no chatbot, no CRM API, no AI logic, no authentication, and no business endpoints.

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

## Current Technical Routes

- `GET /health`: technical health check only.

This is not a business API endpoint.

## PostgreSQL

The startup process calls a PostgreSQL connection check before listening for requests.

If PostgreSQL is unreachable, the backend fails to start instead of running in a degraded unclear state.

## Logging

Fastify/Pino logging is configured through `LOG_LEVEL`.

Future integrations such as Sentry must not replace business audit logs or privacy audit logs.

## Error Handling

The backend includes a global error handler that returns stable error payloads and logs internal details server-side.

## Deployment

The V1 target platform remains Render or another Node.js-compatible managed platform.

Docker is not included in this foundation because the validated V1 architecture does not require it.
