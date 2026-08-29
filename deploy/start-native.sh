#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"

requested_port="${PORT:-}"
set -a
source "$APP_DIR/.env.runtime"
set +a

export NODE_ENV=production
export HOSTNAME="${HOSTNAME:-127.0.0.1}"
export PORT="${requested_port:-${PORT:-8889}}"

exec "${VALK_NODE_BIN:-node}" "$APP_DIR/node_modules/next/dist/bin/next" start --hostname "$HOSTNAME" --port "$PORT"
