# Security Review - VISITOR-OS v0.1.0 RC

## Summary

The MVP is safer after hardening, but it is not ready for public production because authentication is intentionally absent.

## Reviewed Areas

## Validation

- Request payloads use Zod.
- Invalid payloads now return `400 VALIDATION_ERROR`.
- Message content is limited to 2000 characters.

## SQL Injection

- SQL uses parameterized queries.
- Search input is passed as a parameter.
- No string-concatenated SQL was found in runtime code.

## XSS

- Widget inserts message content through `textContent`.
- Admin uses Vue interpolation.
- No direct `innerHTML` is used with user-provided content.

## CORS

- Development/test can allow permissive origins for local DX.
- Production now requires explicit `ALLOWED_ORIGINS`.

## Headers

Added:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: no-referrer`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

## Secrets

- No real secrets found.
- `.env.example` contains placeholders only.

## Logs

- Request body is not logged.
- Operational errors still log stack traces server-side. Acceptable for MVP, but production log retention and redaction policy must be defined.

## Rate Limiting

- Added simple in-memory rate limiting.
- It is acceptable for a single-instance MVP.
- It is not sufficient for distributed production.

## Remaining Risks

- No authentication.
- No authorization.
- Admin endpoints must remain private/unexposed.
- No CSRF strategy yet because auth does not exist.
- No automated dependency audit command configured.

## Recommendation

GO for controlled local/staging testing. NO GO for public production until authentication and deployment controls are added.
