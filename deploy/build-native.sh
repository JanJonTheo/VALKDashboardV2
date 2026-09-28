#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"

# Next persists headers at build time. Use the same public/media origins as
# start-native.sh, otherwise a runtime-only media URL is blocked by the CSP.
set -a
source "$APP_DIR/.env.runtime"
set +a
export NODE_ENV=production
exec "${VALK_NODE_BIN:-node}" "$APP_DIR/node_modules/next/dist/bin/next" build --webpack "$@"
