#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ -f "$ROOT_DIR/deployment/.env.production" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$ROOT_DIR/deployment/.env.production"
  set +a
fi

BASE_URL="${VISITOR_OS_BASE_URL:-http://127.0.0.1:${BACKEND_PORT:-3000}}"

check_endpoint() {
  local path="$1"
  local url="$BASE_URL$path"
  local status
  status="$(curl -fsS -o /dev/null -w "%{http_code}" "$url")"
  if [ "$status" != "200" ]; then
    echo "$path failed with HTTP $status" >&2
    exit 1
  fi
  echo "$path OK"
}

check_endpoint /health
check_endpoint /live
check_endpoint /ready

echo "VISITOR-OS healthcheck OK"
