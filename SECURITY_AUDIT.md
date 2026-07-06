# VISITOR-OS Security Audit - v1.0.0-RC1

## Scope

This audit covers authentication, authorization, input validation, SQL safety, browser security, logs, secrets and deployment variables for the RC1 milestone.

## JWT

- JWT login, `/me`, `/dashboard`, and protected admin routes are implemented.
- Expiration is configured by `JWT_TTL_SECONDS`.
- Tokens are stored in session storage in the current admin UI. This is acceptable for beta, but an httpOnly cookie strategy should be reconsidered for v1.0 if the admin UI becomes a separate frontend.

## RBAC

- Roles are defined: `SuperAdmin`, `Admin`, `Manager`, `Agent`, `Viewer`.
- Mutating routes enforce permissions.
- Organization-scoped users are constrained to their own organization.
- SuperAdmin can access cross-organization data intentionally.

## Validation

- Zod/environment validation exists.
- Admin DTOs and CSV import validation reject malformed or unsafe rows.
- CSV import now reports rejected rows and caps preview responses.

## SQL Injection

- Database access uses parameterized queries.
- CSV values are not interpolated directly into SQL.
- Dynamic filters should continue to use whitelisted fields only.

## XSS

- Admin UI renders Vue template values with escaping by default.
- Generated static assets do not expose secrets.
- User-provided long text is displayed in tables and text areas; future rich text rendering must sanitize aggressively.

## CSRF

- JWT Bearer token authentication reduces classic cookie CSRF risk.
- If httpOnly cookies are reintroduced for admin JWT, CSRF tokens should be added.

## Headers

- Security headers are registered globally.
- Current baseline includes frame, content type, referrer and permissions protections.

## Logs

- Optional file logs exist for application, error and audit events.
- Logs should never include API keys, passwords or full `DATABASE_URL`.
- Audit logs should eventually gain retention and export controls.

## Secrets

- `.env.example` files contain placeholders only.
- Real secrets must live in Railway/Render environment variables.
- `ADMIN_SESSION_SECRET`, `FIRST_ADMIN_PASSWORD`, provider keys and DB credentials must never be committed.

## Environment Variables

- `DATABASE_URL` is optional for boot but required for full production functionality.
- OpenAI and Resend keys are optional.
- Production should set `NODE_ENV=production`, `APP_VERSION=v1.0.0-RC1`, strong auth secrets and strict `ALLOWED_ORIGINS`.

## Security Risks Remaining

- Admin JWT in session storage.
- No external WAF configured by repository.
- No automated dependency audit in pushed CI yet due GitHub workflow token limitation.
- No persistent rate-limit store for multi-instance deployment.

## RC1 Decision

GO for controlled RC1. Before public production, resolve CI workflow push, add dependency audit in CI, and review JWT storage strategy.

