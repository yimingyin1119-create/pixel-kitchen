#!/usr/bin/env bash
# Copies the server's nightly n8n database backups to iCloud Drive (never into this repo: it is public).
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
set -a; . "$REPO/deploy/.env"; set +a
DEST="$HOME/Library/Mobile Documents/com~apple~CloudDocs/乡村小厨备份"
mkdir -p "$DEST"
rsync -a "${PK_SSH_USER:-ubuntu}@$PK_HOST:/opt/pixel-kitchen/backups/" "$DEST/"
ls -1 "$DEST" | tail -3
echo "备份已同步到 iCloud：乡村小厨备份/"
