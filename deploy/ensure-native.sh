#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HEALTH_URL="http://127.0.0.1:${PORT:-8889}/api/health"
mkdir -p "$APP_DIR/logs" "$APP_DIR/run"
exec 9>"$APP_DIR/run/start.lock"
flock -n 9 || exit 0

if command -v curl >/dev/null 2>&1 && curl --fail --silent --max-time 5 "$HEALTH_URL" >/dev/null; then
  exit 0
fi

if [[ -s "$APP_DIR/run/dashboard.pid" ]] && kill -0 "$(<"$APP_DIR/run/dashboard.pid")" 2>/dev/null; then
  exit 1
fi

nohup "$APP_DIR/deploy/start-native.sh" >>"$APP_DIR/logs/dashboard.log" 2>&1 &
echo "$!" >"$APP_DIR/run/dashboard.pid"
