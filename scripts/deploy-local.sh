#!/usr/bin/env bash
# Builds workflows and loads them into the local n8n (must not be running). Usage: deploy-local.sh [test|prod]
set -euo pipefail
. "$(dirname "$0")/n8n-env.sh"
ENV="${1:-test}"
cd "$REPO"
node n8n/build.mjs --env "$ENV"
"$N8N_BIN" import:workflow --separate --input=n8n/dist
for id in pkAuth0000000001 pkNotify00000001 pkApi00000000001 pkSetup000000001; do
  "$N8N_BIN" publish:workflow --id="$id"
done
echo "deployed ($ENV) to $N8N_USER_FOLDER — after n8n starts, POST http://localhost:$N8N_PORT/webhook/pk-setup once to create tables"
