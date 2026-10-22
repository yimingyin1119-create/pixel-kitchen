#!/usr/bin/env bash
# Manages the production server (Tencent Cloud Lighthouse, Singapore).
#   server.sh init <ip>   write deploy/.env for this server
#   server.sh provision   install Docker, folders and the nightly backup (once)
#   server.sh deploy      build prod workflows, load them into n8n, start everything
#   server.sh e2e         run the end-to-end tests on the server against a throwaway n8n
#   server.sh reset       back up, then wipe all app data and write the preset recipes (asks you to type RESET)
#   server.sh reset-pin   give a member who forgot their pin a new one (typed here, not shown)
#   server.sh set-key     store the Anthropic API key as an n8n credential
#   server.sh editor      open the n8n editor at http://localhost:5678 through an SSH tunnel
#   server.sh logs        follow n8n logs
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$REPO/deploy/.env"
REMOTE_DIR=/opt/pixel-kitchen
WORKFLOW_IDS="pkAuth0000000001 pkNotify00000001 pkApi00000000001 pkSetup000000001 pkReset000000001 pkSeed0000000001 pkAdmin000000001"

load_env() {
  [ -f "$ENV_FILE" ] || { echo "先运行: scripts/server.sh init <服务器IP>"; exit 1; }
  set -a; . "$ENV_FILE"; set +a
  TARGET="${PK_SSH_USER:-ubuntu}@$PK_HOST"
}
remote() { ssh -o BatchMode=yes "$TARGET" "$@"; }

# Loads workflows into the compose service $1 (stopped), publishes them, then starts it.
load_workflows() {
  local svc=$1 profile=$2
  remote "cd $REMOTE_DIR && sudo docker compose $profile stop $svc >/dev/null 2>&1 || true
    sudo docker compose $profile run --rm --no-deps $svc import:workflow --separate --input=/workflows
    for id in $WORKFLOW_IDS; do sudo docker compose $profile run --rm --no-deps $svc publish:workflow --id=\$id; done
    sudo docker compose $profile up -d $svc"
}

wait_and_setup() {
  local url=$1
  remote "for i in \$(seq 1 60); do curl -fs $url/healthz >/dev/null && break; sleep 2; done
    for i in \$(seq 1 30); do code=\$(curl -s -o /dev/null -w '%{http_code}' -X POST $url/webhook/pk-setup); [ \"\$code\" = 200 ] && exit 0; sleep 2; done
    echo 'table setup failed'; exit 1"
  remote "curl -fs -X POST $url/webhook/pk-seed"; echo
}

case "${1:-}" in
  init)
    ip="${2:?usage: server.sh init <ip>}"
    domain="${ip//./-}.sslip.io"
    sed -e "s/^PK_HOST=.*/PK_HOST=$ip/" -e "s/^PK_DOMAIN=.*/PK_DOMAIN=$domain/" \
        -e "s#^WEBHOOK_URL=.*#WEBHOOK_URL=https://$domain/#" "$REPO/deploy/.env.example" > "$ENV_FILE"
    echo "wrote deploy/.env for $ip ($domain)"
    ;;
  provision)
    load_env
    remote "set -e
      sudo apt-get update -qq
      sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq docker.io docker-compose-v2 sqlite3 rsync curl >/dev/null
      sudo systemctl enable --now docker
      sudo mkdir -p $REMOTE_DIR/n8n-data $REMOTE_DIR/workflows $REMOTE_DIR/backups $REMOTE_DIR/repo
      sudo chown -R \$(id -u):\$(id -g) $REMOTE_DIR
      sudo chown -R 1000:1000 $REMOTE_DIR/n8n-data
      echo '0 4 * * * root cd $REMOTE_DIR && sqlite3 n8n-data/database.sqlite \".backup backups/pk-\$(date +\\%F).sqlite\" && ls -1t backups/pk-*.sqlite | tail -n +15 | xargs -r rm' | sudo tee /etc/cron.d/pixel-kitchen-backup >/dev/null
      sudo docker --version; sudo docker compose version"
    ;;
  deploy)
    load_env
    node "$REPO/n8n/build.mjs" --env prod
    rsync -a "$REPO/deploy/docker-compose.yml" "$REPO/deploy/Caddyfile" "$ENV_FILE" "$TARGET:$REMOTE_DIR/"
    rsync -a --delete "$REPO/n8n/dist/" "$TARGET:$REMOTE_DIR/workflows/"
    remote "cd $REMOTE_DIR && sudo docker compose pull -q n8n caddy"
    load_workflows n8n ""
    remote "cd $REMOTE_DIR && sudo docker compose up -d caddy"
    wait_and_setup http://127.0.0.1:5678
    echo "deployed: https://$PK_DOMAIN/webhook/pk/api"
    ;;
  e2e)
    load_env
    rsync -a --delete --exclude node_modules --exclude .git --exclude .n8n-test --exclude .superpowers \
      --exclude 'n8n/dist' --exclude deploy/.env "$REPO/" "$TARGET:$REMOTE_DIR/repo/"
    rsync -a "$REPO/deploy/docker-compose.yml" "$TARGET:$REMOTE_DIR/"
    remote "cd $REMOTE_DIR && sudo docker compose --profile e2e down -v --remove-orphans >/dev/null 2>&1 || true
      sudo docker run --rm -v $REMOTE_DIR/repo:/repo -w /repo node:24-bookworm-slim sh -c 'npm ci --no-audit --no-fund >/dev/null && node n8n/build.mjs --env e2e'"
    load_workflows n8n-e2e "--profile e2e"
    remote "cd $REMOTE_DIR && sudo docker compose --profile e2e run --rm --use-aliases e2e-runner; code=\$?
      sudo docker compose --profile e2e logs n8n-e2e > repo/e2e-n8n.log 2>&1
      sudo docker compose --profile e2e down -v >/dev/null 2>&1; exit \$code"
    ;;
  reset)
    load_env
    echo "将要在 $PK_HOST 上："
    echo "  1. 备份数据库到 $REMOTE_DIR/backups/pre-reset-<时间>.sqlite"
    echo "  2. 删除全部 7 张数据表（账号、菜谱、要求、食材、采购……）"
    echo "  3. 重新建表，并写入 12 道预设菜谱"
    printf '确定的话输入 RESET：'
    read -r answer
    [ "$answer" = "RESET" ] || { echo "没有输入 RESET，什么都没做。"; exit 1; }
    stamp=$(date +%Y%m%d-%H%M%S)
    remote "cd $REMOTE_DIR && sudo sqlite3 n8n-data/database.sqlite \".backup backups/pre-reset-$stamp.sqlite\" && ls -la backups/pre-reset-$stamp.sqlite"
    remote "curl -fs -X POST http://127.0.0.1:5678/webhook/pk-reset"; echo
    wait_and_setup http://127.0.0.1:5678
    echo "重置完成。需要恢复时：停掉 n8n，用 backups/pre-reset-$stamp.sqlite 替换 n8n-data/database.sqlite，再启动。"
    ;;
  reset-pin)
    load_env
    printf '谁忘了口令（名字）：'; read -r who
    printf '新的 4 位口令（输入时不显示）：'; read -rs pin; echo
    body=$(WHO="$who" PIN="$pin" node -e 'process.stdout.write(JSON.stringify({action:"admin.resetPin",payload:{name:process.env.WHO,pin:process.env.PIN}}))')
    printf '%s' "$body" | remote "curl -s -X POST -H 'content-type: application/json' --data-binary @- http://127.0.0.1:5678/webhook/pk-admin"; echo
    ;;
  set-key)
    load_env
    PK_SSH_USER="${PK_SSH_USER:-ubuntu}" PK_HOST="$PK_HOST" "$REPO/scripts/set-anthropic-key.sh" --docker
    ;;
  editor)
    load_env
    echo "n8n 编辑器：http://localhost:5678 （按 Ctrl+C 关闭）"
    ssh -N -L 5678:127.0.0.1:5678 "$TARGET"
    ;;
  logs)
    load_env
    remote "cd $REMOTE_DIR && sudo docker compose logs -f --tail=100 n8n"
    ;;
  *)
    sed -n '2,10p' "$0"; exit 1
    ;;
esac
