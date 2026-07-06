#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker Desktop is required on macOS." >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose v2 is required." >&2
  exit 1
fi

cd "$ROOT_DIR"

if [ ! -f deployment/.env.production ]; then
  cp deployment/.env.production.example deployment/.env.production
  echo "Created deployment/.env.production. Edit secrets before production use."
fi

scripts/install.sh

