#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ "${NODE_ENV:-}" == test && -n "${RUNTIME_PROJECT_SOURCE:-}" && -d "${RUNTIME_PROJECT_SOURCE:-}" ]]; then
  project_dir="$(cd "$RUNTIME_PROJECT_SOURCE" && pwd)"
fi
mode="${1:-start}"
case "$mode" in
  check)
    test -f "$project_dir/.env" || { echo "Missing .env; copy and configure .env.example." >&2; exit 1; }
    test -d "$project_dir/backend/node_modules" || { echo "Backend dependencies absent; run scripts/bootstrap.sh explicitly." >&2; exit 1; }
    test -d "$project_dir/frontend/node_modules" || { echo "Frontend dependencies absent; run scripts/bootstrap.sh explicitly." >&2; exit 1; }
    ;;
  migrate)
    exec "$project_dir/scripts/migrate.sh"
    ;;
  start)
    "$0" check
    BACKEND_PORT="${BACKEND_PORT:?BACKEND_PORT is required}"; FRONTEND_PORT="${FRONTEND_PORT:?FRONTEND_PORT is required}"
    : "${DATABASE_URL:?DATABASE_URL is required}"
    JWT_SECRET_VALUE="${JWT_SECRET:-}"; [[ "${#JWT_SECRET_VALUE}" -ge 32 ]] || { echo 'JWT_SECRET must contain at least 32 characters.' >&2; exit 1; }
    if [[ "${NODE_ENV:-}" == test ]]; then
      export CLIENT_URL="${CLIENT_URL:-http://127.0.0.1:$FRONTEND_PORT}"
      export JWT_ISSUER="${JWT_ISSUER:-wildfire-runtime}"
      export JWT_AUDIENCE="${JWT_AUDIENCE:-wildfire-operators}"
    fi
    : "${CLIENT_URL:?CLIENT_URL is required}"; : "${JWT_ISSUER:?JWT_ISSUER is required}"; : "${JWT_AUDIENCE:?JWT_AUDIENCE is required}"
    for port in "$BACKEND_PORT" "$FRONTEND_PORT"; do if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then echo "Port $port is occupied; no process was terminated." >&2; exit 1; fi; done
    (cd "$project_dir/backend" && BACKEND_PORT="$BACKEND_PORT" npm start) & backend_pid=$!
    (cd "$project_dir/frontend" && PORT="$FRONTEND_PORT" REACT_APP_API_URL="http://127.0.0.1:$BACKEND_PORT/api" BROWSER=none npm start) & frontend_pid=$!
    cleanup(){ kill "$backend_pid" "$frontend_pid" 2>/dev/null || true; wait "$backend_pid" "$frontend_pid" 2>/dev/null || true; }
    trap cleanup EXIT INT TERM
    wait "$backend_pid" "$frontend_pid"
    ;;
  *) echo "Usage: ./start.sh [check|migrate|start]" >&2; exit 64 ;;
esac
