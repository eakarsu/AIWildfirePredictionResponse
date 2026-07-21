#!/usr/bin/env bash
set -euo pipefail
if [[ "${ALLOW_DEVELOPMENT_SEED:-}" != "yes" ]]; then
  echo "Refusing to seed without ALLOW_DEVELOPMENT_SEED=yes" >&2
  exit 1
fi
echo "No operational incidents, users, credentials, telemetry, or dispatches are seeded."
