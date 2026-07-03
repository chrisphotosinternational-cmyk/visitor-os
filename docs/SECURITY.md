# Security

## Sprint 5 Security Baseline

Implemented:

- protected admin routes;
- bcrypt password hashes;
- signed httpOnly cookies;
- production `Secure` cookies;
- production CORS origin requirement;
- organization access checks;
- role and permission checks;
- Zod validation on login and admin payloads.

## Sensitive Data

The backend never returns password hashes or session tokens in JSON responses.

The session token is stored as a SHA-256 hash in the database.

## Remaining Risks

- JWT admin routes use bearer tokens; do not store them in third-party scripts.
- Cookie session routes keep `SameSite=Lax`; add CSRF tokens before enabling unsafe cookie-authenticated forms from external origins.
- No password reset flow.
- No brute-force lockout beyond the existing simple rate limiter.
- No 2FA.
- Audit logging now exists at file level when `FILE_LOGS_ENABLED=true`; keep `audit.log` out of public storage.

## Sprint 12 Production Checklist

- Keep `ADMIN_SESSION_SECRET` unique and at least 32 characters.
- Keep `JWT_TTL_SECONDS` short enough for admin risk tolerance.
- Restrict `ALLOWED_ORIGINS` in production.
- Keep rate limiting enabled.
- Validate all new DTOs with Zod before route logic.
- Never log passwords, JWTs, API keys or PostgreSQL credentials.
- Use managed PostgreSQL backups and private connection strings.
- Review `/metrics` exposure before public launch; protect it at the platform/network level if needed.
