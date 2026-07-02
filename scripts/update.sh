#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR"

if command -v git >/dev/null 2>&1; then
  git pull --ff-only
fi

docker compose \
  --env-file deployment/.env.production \
  -f deployment/docker-compose.yml \
  -f deployment/docker-compose.production.yml \
  up -d --build

"$ROOT_DIR/scripts/healthcheck.sh"

