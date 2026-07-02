# Production Deployment

This folder contains the first production-oriented deployment kit for VISITOR-OS Beta Internal.

## Files

- `Dockerfile.backend`: backend Node.js image.
- `Dockerfile.frontend`: static admin image.
- `docker-compose.yml`: local/production base stack.
- `docker-compose.production.yml`: production overrides.
- `.env.production.example`: production environment template.
- `nginx.example.conf`: reverse proxy example.
- `Caddyfile.example`: simpler HTTPS reverse proxy example.
- `CHECKLIST.md`: pre-production checklist.

## Quick Start

```bash
cp deployment/.env.production.example deployment/.env.production
scripts/install.sh
```

Then check:

```bash
scripts/healthcheck.sh
```

## Recommended First Target

For `chambres-dhotes-albi.com`, keep the first installation simple:

```text
Caddy or Nginx
-> frontend container
-> backend container
-> PostgreSQL container
```

Do not add extra services before the first real validation.
