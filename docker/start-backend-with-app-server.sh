#!/usr/bin/env bash

set -euo pipefail

APP_SERVER_URL="${CODEX_APP_SERVER_URL:-ws://127.0.0.1:4500}"
PORT_VALUE="${PORT:-8000}"

cleanup() {
  if [[ -n "${APP_SERVER_PID:-}" ]]; then
    kill "${APP_SERVER_PID}" 2>/dev/null || true
    wait "${APP_SERVER_PID}" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

mkdir -p /app/backend/data

codex app-server --listen "${APP_SERVER_URL}" &
APP_SERVER_PID=$!

cd /app/backend
exec node --enable-source-maps dist/server.js
