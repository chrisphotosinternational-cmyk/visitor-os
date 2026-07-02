#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/deployment/.env.production"
ENV_EXAMPLE="$ROOT_DIR/deployment/.env.production.example"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required." >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose v2 is required." >&2
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  cp "$ENV_EXAMPLE" "$ENV_FILE"
  echo "Created deployment/.env.production. Edit it before production use."
fi

cd "$ROOT_DIR"

docker compose \
  --env-file deployment/.env.production \
  -f deployment/docker-compose.yml \
  -f deployment/docker-compose.production.yml \
  up -d --build

"$ROOT_DIR/scripts/healthcheck.sh"

