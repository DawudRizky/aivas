#!/bin/sh
set -e
echo "[entrypoint] NODE_ENV=${NODE_ENV:-production} DEBUG=${DEBUG:-0} NODE_OPTIONS=${NODE_OPTIONS:-}" >&2
# Ensure source maps for better stack traces
if [ -z "$NODE_OPTIONS" ]; then
  export NODE_OPTIONS="--enable-source-maps"
fi

echo "[entrypoint] NODE_OPTIONS=$NODE_OPTIONS" >&2

# If a local env file exists in the app directory, source it so runtime sees same envs
if [ -f /app/.env.local ]; then
  echo "[entrypoint] sourcing /app/.env.local" >&2
  set -a
  # shellcheck disable=SC1091
  . /app/.env.local
  set +a
fi

exec npm run start
