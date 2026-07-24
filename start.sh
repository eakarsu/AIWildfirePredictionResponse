#!/usr/bin/env bash
set -euo pipefail
# Local demo credential bridge (managed by tools/fix_demo_autofill.mjs)
demo_credentials_project_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
if [ -f "$demo_credentials_project_dir/.env" ]; then
  while IFS= read -r demo_credentials_line || [ -n "$demo_credentials_line" ]; do
    case "$demo_credentials_line" in ''|'#'*) continue ;; esac
    demo_credentials_line="${demo_credentials_line#export }"
    demo_credentials_key="${demo_credentials_line%%=*}"
    demo_credentials_value="${demo_credentials_line#*=}"
    case "$demo_credentials_key" in
      NODE_ENV|ENABLE_DEMO_CREDENTIAL_AUTOFILL|DEMO_EMAIL|DEMO_PASSWORD|SEED_ADMIN_EMAIL|SEED_ADMIN_PASSWORD|ADMIN_EMAIL|ADMIN_PASSWORD|DEFAULT_EMAIL|DEFAULT_PASSWORD) ;;
      *) continue ;;
    esac
    [ -n "${!demo_credentials_key+x}" ] && continue
    demo_credentials_first="${demo_credentials_value:0:1}"
    demo_credentials_last="${demo_credentials_value: -1}"
    if { [ "$demo_credentials_first" = '"' ] && [ "$demo_credentials_last" = '"' ]; } || { [ "$demo_credentials_first" = "'" ] && [ "$demo_credentials_last" = "'" ]; }; then
      demo_credentials_value="${demo_credentials_value:1:${#demo_credentials_value}-2}"
    fi
    export "$demo_credentials_key=$demo_credentials_value"
  done < "$demo_credentials_project_dir/.env"
fi
demo_credentials_email=""
demo_credentials_password=""
if [ -n "${DEMO_EMAIL:-}" ] && [ -n "${DEMO_PASSWORD:-}" ]; then
  demo_credentials_email="$DEMO_EMAIL"
  demo_credentials_password="$DEMO_PASSWORD"
elif [ -n "${SEED_ADMIN_EMAIL:-}" ] && [ -n "${SEED_ADMIN_PASSWORD:-}" ]; then
  demo_credentials_email="$SEED_ADMIN_EMAIL"
  demo_credentials_password="$SEED_ADMIN_PASSWORD"
elif [ -n "${ADMIN_EMAIL:-}" ] && [ -n "${ADMIN_PASSWORD:-}" ]; then
  demo_credentials_email="$ADMIN_EMAIL"
  demo_credentials_password="$ADMIN_PASSWORD"
elif [ -n "${DEFAULT_EMAIL:-}" ] && [ -n "${DEFAULT_PASSWORD:-}" ]; then
  demo_credentials_email="$DEFAULT_EMAIL"
  demo_credentials_password="$DEFAULT_PASSWORD"
fi
if [ "${NODE_ENV:-development}" != production ] && [ "${ENABLE_DEMO_CREDENTIAL_AUTOFILL:-true}" = true ] && [ -n "$demo_credentials_email" ] && [ -n "$demo_credentials_password" ]; then
  export VITE_ENABLE_DEMO_CREDENTIAL_AUTOFILL=true
  export VITE_DEMO_EMAIL="$demo_credentials_email"
  export VITE_DEMO_PASSWORD="$demo_credentials_password"
  export REACT_APP_ENABLE_DEMO_CREDENTIAL_AUTOFILL=true
  export REACT_APP_DEMO_EMAIL="$demo_credentials_email"
  export REACT_APP_DEMO_PASSWORD="$demo_credentials_password"
  export NEXT_PUBLIC_ENABLE_DEMO_CREDENTIAL_AUTOFILL=true
  export NEXT_PUBLIC_DEMO_EMAIL="$demo_credentials_email"
  export NEXT_PUBLIC_DEMO_PASSWORD="$demo_credentials_password"
else
  export VITE_ENABLE_DEMO_CREDENTIAL_AUTOFILL=false
  export REACT_APP_ENABLE_DEMO_CREDENTIAL_AUTOFILL=false
  export NEXT_PUBLIC_ENABLE_DEMO_CREDENTIAL_AUTOFILL=false
  unset VITE_DEMO_EMAIL VITE_DEMO_PASSWORD REACT_APP_DEMO_EMAIL REACT_APP_DEMO_PASSWORD NEXT_PUBLIC_DEMO_EMAIL NEXT_PUBLIC_DEMO_PASSWORD
fi
unset demo_credentials_email demo_credentials_password demo_credentials_project_dir demo_credentials_line demo_credentials_key demo_credentials_value demo_credentials_first demo_credentials_last

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
test -f "$project_dir/.env" || { echo "Missing .env; copy and configure .env.example." >&2; exit 1; }
set -a
. "$project_dir/.env"
set +a
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
    [[ "$BACKEND_PORT" != "$FRONTEND_PORT" ]] || { echo 'Backend and frontend ports must differ.' >&2; exit 1; }
    : "${DATABASE_URL:?DATABASE_URL is required}"
    : "${OPENROUTER_API_KEY:?OPENROUTER_API_KEY is required}"; : "${OPENROUTER_MODEL:?OPENROUTER_MODEL is required}"
    [[ "${OPENROUTER_BASE_URL:-}" == "https://openrouter.ai/api/v1" ]] || { echo 'OPENROUTER_BASE_URL must be https://openrouter.ai/api/v1.' >&2; exit 1; }
    [[ "${ALLOW_SCHEMA_MIGRATION:-}" == true ]] || { echo 'ALLOW_SCHEMA_MIGRATION=true is required.' >&2; exit 1; }
    JWT_SECRET_VALUE="${JWT_SECRET:-}"; [[ "${#JWT_SECRET_VALUE}" -ge 32 ]] || { echo 'JWT_SECRET must contain at least 32 characters.' >&2; exit 1; }
    if [[ "${NODE_ENV:-}" == test ]]; then
      export CLIENT_URL="${CLIENT_URL:-http://127.0.0.1:$FRONTEND_PORT}"
      export JWT_ISSUER="${JWT_ISSUER:-wildfire-runtime}"
      export JWT_AUDIENCE="${JWT_AUDIENCE:-wildfire-operators}"
    fi
    : "${CLIENT_URL:?CLIENT_URL is required}"; : "${JWT_ISSUER:?JWT_ISSUER is required}"; : "${JWT_AUDIENCE:?JWT_AUDIENCE is required}"
    for port in "$BACKEND_PORT" "$FRONTEND_PORT"; do if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then echo "Port $port is occupied; no process was changed." >&2; exit 1; fi; done
    (cd "$project_dir/backend" && node scripts/prepare-runtime.js)
    (cd "$project_dir/backend" && BACKEND_PORT="$BACKEND_PORT" npm start) & backend_pid=$!
    (cd "$project_dir/frontend" && PORT="$FRONTEND_PORT" REACT_APP_API_URL="http://127.0.0.1:$BACKEND_PORT/api" BROWSER=none npm start) & frontend_pid=$!
    cleanup(){ kill "$backend_pid" "$frontend_pid" 2>/dev/null || true; wait "$backend_pid" "$frontend_pid" 2>/dev/null || true; }
    trap cleanup EXIT INT TERM
    wait "$backend_pid" "$frontend_pid"
    ;;
  *) echo "Usage: ./start.sh [check|migrate|start]" >&2; exit 64 ;;
esac
