# VISITOR-OS Installation Guide - v1.0.0-RC1

## Recommended Hosting

For beta and RC1, use Railway or Render with managed PostgreSQL. OVH Web mutualise is not suitable for the backend.

## Required Variables

- `NODE_ENV=production`
- `APP_VERSION=v1.0.0-RC1`
- `DATABASE_URL`
- `ADMIN_SESSION_SECRET`
- `FIRST_ADMIN_EMAIL`
- `FIRST_ADMIN_PASSWORD`
- `ALLOWED_ORIGINS`

## Railway

1. Connect GitHub repository.
2. Use the root project configuration.
3. Add PostgreSQL.
4. Set environment variables.
5. Deploy.
6. Check `/live`, `/health`, `/ready`, `/system`.

## Local Docker Reference

```bash
cp deployment/.env.production.example deployment/.env.production
scripts/install.sh
```

Docker Compose is a reference stack for validation and self-managed environments.

