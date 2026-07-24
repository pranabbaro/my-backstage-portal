#!/usr/bin/env bash
set -euo pipefail

cd /home/site/wwwroot/backstage

export NODE_ENV=production
export PORT="${PORT:-8080}"

echo "Starting Enterprise Developer Portal on port ${PORT}"

exec node packages/backend   --config app-config.yaml   --config app-config.production.appservice.yaml
