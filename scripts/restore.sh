#!/usr/bin/env bash
set -euo pipefail

if [ "${1:-}" = "" ]; then
  echo "Usage: scripts/restore.sh backups/YYYYMMDD-HHMMSS" >&2
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_PATH="$1"

if [ ! -f "$BACKUP_PATH/postgres.dump" ]; then
  echo "Missing postgres.dump in backup path." >&2
  exit 1
fi

cd "$ROOT_DIR"

set -a
# shellcheck disable=SC1091
. deployment/.env.production
set +a

docker compose \
  --env-file deployment/.env.production \
  -f deployment/docker-compose.yml \
  up -d postgres

docker compose \
  --env-file deployment/.env.production \
  -f deployment/docker-compose.yml \
  exec -T postgres sh -c "cat > /tmp/visitor_os_restore.dump" < "$BACKUP_PATH/postgres.dump"

docker compose \
  --env-file deployment/.env.production \
  -f deployment/docker-compose.yml \
  exec -T postgres pg_restore \
  -U "${POSTGRES_USER:-visitor_os}" \
  -d "${POSTGRES_DB:-visitor_os}" \
  --clean \
  --if-exists \
  /tmp/visitor_os_restore.dump

if [ -f "$BACKUP_PATH/configs.tar.gz" ]; then
  tar -xzf "$BACKUP_PATH/configs.tar.gz" -C "$ROOT_DIR"
fi

echo "Restore completed from: $BACKUP_PATH"

