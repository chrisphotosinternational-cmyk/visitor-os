#!/usr/bin/env bash
set -euo pipefail

if [ "${1:-}" = "" ]; then
  echo "Usage: scripts/import-complete.sh exports/visitor-os-complete-YYYYMMDD-HHMMSS backups/YYYYMMDD-HHMMSS" >&2
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXPORT_PATH="$1"
BACKUP_PATH="${2:-}"

if [ ! -d "$EXPORT_PATH" ]; then
  echo "Export path not found: $EXPORT_PATH" >&2
  exit 1
fi

cd "$ROOT_DIR"

if [ -d "$EXPORT_PATH/configs" ]; then
  rm -rf configs
  cp -R "$EXPORT_PATH/configs" configs
fi

if [ -n "$BACKUP_PATH" ]; then
  scripts/restore.sh "$BACKUP_PATH"
fi

echo "Complete import applied from: $EXPORT_PATH"

