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

- No CSRF token yet. `SameSite=Lax` reduces risk but does not replace a full CSRF strategy.
- No password reset flow.
- No brute-force lockout beyond the existing simple rate limiter.
- No 2FA.
- No audit log for admin actions yet.

