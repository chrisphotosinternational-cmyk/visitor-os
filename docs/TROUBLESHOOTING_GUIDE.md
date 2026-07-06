# VISITOR-OS Troubleshooting Guide - v1.0.0-RC1

## Backend Does Not Start

Check environment variables, especially `ADMIN_SESSION_SECRET`, `DATABASE_URL`, `PORT`, `NODE_ENV` and `ALLOWED_ORIGINS`.

## `/ready` Is Not Connected

- `disabled`: no `DATABASE_URL`.
- `error`: database configured but unreachable.
- `ok`: application considers DB usable.

## Login Fails

Check first admin variables, password length, JWT secret and database migrations.

## CSV Import Is Slow

Large imports are hardened but still synchronous. For 50k+ rows, run outside peak usage and keep backups.

## Admin UI Looks Empty

Check `/system`, then `/health` and `/ready`. Confirm that your user has the expected role and organization.

