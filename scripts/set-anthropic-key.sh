#!/usr/bin/env bash
# Stores the Anthropic API key as an n8n credential. The key is typed into this terminal
# and never written anywhere except a temp file that is deleted right away.
#   set-anthropic-key.sh          local n8n
#   set-anthropic-key.sh --test   local n8n with a fake key (tests)
#   set-anthropic-key.sh --docker production server (see scripts/server.sh set-key)
set -euo pipefail
. "$(dirname "$0")/n8n-env.sh"
MODE="${1:-local}"
if [ "$MODE" = "--test" ]; then
  KEY="test-key-not-real"
else
  printf '粘贴 Anthropic API key（输入时不显示），回车结束：'
  read -rs KEY; echo
fi
[ -n "$KEY" ] || { echo "没有输入 key"; exit 1; }
json=$(KEY="$KEY" node -e 'process.stdout.write(JSON.stringify([{id:"pkAnthropicCred1",name:"Anthropic API",type:"httpHeaderAuth",data:{name:"x-api-key",value:process.env.KEY}}]))')
if [ "$MODE" = "--docker" ]; then
  . "$REPO/deploy/.env"
  printf '%s' "$json" | ssh "${PK_SSH_USER:-ubuntu}@$PK_HOST" "cd /opt/pixel-kitchen && sudo docker compose exec -T n8n sh -c 'cat > /tmp/c.json && n8n import:credentials --input=/tmp/c.json; rm -f /tmp/c.json'"
else
  tmp=$(mktemp); trap 'rm -f "$tmp"' EXIT
  printf '%s' "$json" > "$tmp"
  "$N8N_BIN" import:credentials --input="$tmp"
fi
echo "Anthropic key saved as n8n credential 'Anthropic API'"
