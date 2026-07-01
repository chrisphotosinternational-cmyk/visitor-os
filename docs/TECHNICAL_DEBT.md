# Technical Debt - VISITOR-OS v0.1.0 RC

## Current Debt

| Item | Severity | Notes | Recommendation |
|---|---:|---|---|
| No authentication | High | Admin endpoints are open. | Add auth before public deployment. |
| No migration tool | High | Schema is initialized at startup. | Add a migration system before expanding data model. |
| Static admin MVP | Medium | Vue is loaded from CDN. | Replace with Vue/Vite app in a future sprint. |
| In-memory rate limiting | Medium | Does not work across instances. | Replace with Redis/platform rate limit if traffic grows. |
| Hardcoded demo seed | Medium | Demo org/site is fixed. | Move to controlled seed command or admin setup later. |
| No real DB test in CI | Medium | Optional `TEST_DATABASE_URL` exists but is not mandatory. | Add PostgreSQL service in CI later. |
| No frontend test suite | Low | Widget/admin are simple static files. | Add browser tests when UI grows. |

## Accepted for v0.1.0

- No OpenAI.
- No advanced CRM.
- No notifications.
- No bookings/payments.
- No analytics.
- No multi-tenant UI.

These are not defects for this release.

## Next Debt to Pay

1. Authentication and session handling.
2. Database migrations.
3. Replace CDN admin with proper Vue/Vite app.
4. Add deployment-specific environment validation.
5. Add PostgreSQL integration testing in CI.
