#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [ -z "${DATABASE_URL:-}" ]; then
  test -f "$project_dir/.env" || { echo "Missing .env and DATABASE_URL" >&2; exit 1; }
  set -a
  . "$project_dir/.env"
  set +a
fi
: "${DATABASE_URL:?DATABASE_URL is required}"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$project_dir/backend/migrations/001_governed_wildfire.sql"
