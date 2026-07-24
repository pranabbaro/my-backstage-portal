#!/usr/bin/env bash
set -euo pipefail

cd /home/site/wwwroot

export NODE_ENV=production
export PORT="${PORT:-8080}"

echo "Starting Enterprise Developer Portal on ${PORT}"

exec node packages/backend   --config app-config.yaml   --config app-config.production.appservice.yaml
