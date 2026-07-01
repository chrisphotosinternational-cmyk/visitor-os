# Release v0.1.0 - Release Candidate

## Status

Release candidate for the first working VISITOR-OS MVP.

## Included

- Demo widget page without Moto CMS.
- Responsive embeddable widget.
- Backend conversation creation.
- Message persistence.
- Temporary non-AI replies.
- Automatic prospect creation.
- Minimal admin dashboard.
- Conversation list.
- Conversation search.
- Open conversation detail.
- Conversation status update.
- Prospect list.
- Security hardening pass.
- Tests for critical backend behavior.

## Not Included

- OpenAI.
- Advanced CRM.
- Notifications.
- Bookings.
- Payments.
- Authentication.
- Analytics.
- Multi-tenant management UI.

## Verification

Command:

```bash
cd backend
pnpm check
```

Result:

- Typecheck: pass.
- Lint: pass.
- Format check: pass.
- Tests: 10 passed, 1 skipped.
- Build: pass.

The skipped test is the optional PostgreSQL integration test, which requires `TEST_DATABASE_URL`.

## Run Commands

Backend:

```bash
cd backend
pnpm install
cp .env.example .env
pnpm dev
```

Widget demo:

```bash
cd widget
python3 -m http.server 4173
```

Admin:

```bash
cd frontend-admin
python3 -m http.server 5173
```

## Release Risks

- No authentication.
- Startup schema initialization instead of migrations.
- Static admin loaded from Vue CDN.
- In-memory rate limit only.
- No real PostgreSQL integration test executed in current local environment.

## GO / NO GO

GO for Sprint 2 development.

NO GO for public production until authentication, migrations, and deployment hardening are added.
