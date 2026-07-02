#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/deployment/.env.production"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_ROOT="${BACKUP_DIR:-$ROOT_DIR/backups}"
BACKUP_PATH="$BACKUP_ROOT/$TIMESTAMP"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing deployment/.env.production." >&2
  exit 1
fi

mkdir -p "$BACKUP_PATH"
cd "$ROOT_DIR"

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

docker compose \
  --env-file deployment/.env.production \
  -f deployment/docker-compose.yml \
  exec -T postgres pg_dump \
  -U "${POSTGRES_USER:-visitor_os}" \
  -d "${POSTGRES_DB:-visitor_os}" \
  --format=custom > "$BACKUP_PATH/postgres.dump"

tar -czf "$BACKUP_PATH/configs.tar.gz" configs

docker compose \
  --env-file deployment/.env.production \
  -f deployment/docker-compose.yml \
  logs --no-color > "$BACKUP_PATH/docker.log"

cp deployment/.env.production "$BACKUP_PATH/env.production.redacted"
sed -i.bak -E 's/(PASSWORD|SECRET|KEY)=.*/\1=REDACTED/g' "$BACKUP_PATH/env.production.redacted"
rm -f "$BACKUP_PATH/env.production.redacted.bak"

echo "Backup created: $BACKUP_PATH"
