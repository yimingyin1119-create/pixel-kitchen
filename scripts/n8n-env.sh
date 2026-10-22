# Environment for the local n8n used by end-to-end tests. Source it: `. scripts/n8n-env.sh`
REPO="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")/.." && pwd)"
export N8N_USER_FOLDER="${N8N_USER_FOLDER:-$REPO/.n8n-test}"
export N8N_PORT="${N8N_PORT:-5679}"
export GENERIC_TIMEZONE=Asia/Singapore
export N8N_CONCURRENCY_PRODUCTION_LIMIT=1
export EXECUTIONS_DATA_PRUNE=true
export EXECUTIONS_DATA_MAX_AGE=168
export N8N_DIAGNOSTICS_ENABLED=false
export N8N_PERSONALIZATION_ENABLED=false
export N8N_SECURE_COOKIE=false
export N8N_BIN="$REPO/n8n/runtime/node_modules/.bin/n8n"
