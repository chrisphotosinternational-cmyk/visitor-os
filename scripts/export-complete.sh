#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
EXPORT_ROOT="${EXPORT_DIR:-$ROOT_DIR/exports}"
EXPORT_PATH="$EXPORT_ROOT/visitor-os-complete-$TIMESTAMP"

mkdir -p "$EXPORT_PATH"
cd "$ROOT_DIR"

scripts/backup.sh

cp -R configs "$EXPORT_PATH/configs"
cp CHANGELOG.md README.md ROADMAP.md "$EXPORT_PATH/"
tar -czf "$EXPORT_PATH/documentation.tar.gz" docs legal database deployment scripts

echo "Complete export created: $EXPORT_PATH"

