# Authentication

## Scope

Sprint 5 adds administrator authentication for VISITOR-OS.

Implemented:

- login;
- logout;
- current user endpoint;
- bcrypt password hashing through `bcryptjs`;
- httpOnly session cookie;
- signed session token;
- session revocation;
- controlled renewal;
- first admin bootstrap through environment variables.

## Routes

- `POST /api/admin/auth/login`
- `POST /api/admin/auth/logout`
- `GET /api/admin/auth/me`

All other `/api/admin/*` routes require a valid session.

## Environment

Required before production:

- `ADMIN_SESSION_SECRET`
- `FIRST_ADMIN_EMAIL`
- `FIRST_ADMIN_PASSWORD`

Optional:

- `FIRST_ADMIN_FIRST_NAME`
- `FIRST_ADMIN_LAST_NAME`
- `FIRST_ADMIN_ORGANIZATION_ID`
- `ADMIN_SESSION_TTL_MS`
- `ADMIN_SESSION_RENEWAL_MS`

## Cookies

The session cookie is:

- `httpOnly`;
- `SameSite=Lax`;
- `Secure` in production;
- signed server-side;
- expired on logout.

## First Admin

If `FIRST_ADMIN_EMAIL` and `FIRST_ADMIN_PASSWORD` are set, the backend creates the first `SuperAdmin` when no user with that email exists.

