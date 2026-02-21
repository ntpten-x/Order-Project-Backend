#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="${1:-/srv/order-project/backend}"
COMPOSE_FILE="${2:-${REPO_DIR}/deploy/aws/docker-compose.backend.prod.yml}"
ENV_FILE="${3:-${REPO_DIR}/deploy/aws/backend.env}"
CRON_SCHEDULE="${4:-0 3 * * *}"
LOG_FILE="${5:-${REPO_DIR}/logs/retention-cron.log}"
MARKER="# ORDER_BACKEND_RETENTION_JOB"
RUNNER_SCRIPT="${REPO_DIR}/scripts/deploy/aws/run-retention-job.sh"

mkdir -p "$(dirname "$LOG_FILE")"

if [[ ! -f "$RUNNER_SCRIPT" ]]; then
    echo "[install-cron] ERROR: missing runner script: $RUNNER_SCRIPT" >&2
    exit 1
fi

ENTRY="${CRON_SCHEDULE} cd ${REPO_DIR} && COMPOSE_FILE=${COMPOSE_FILE} ENV_FILE=${ENV_FILE} bash ${RUNNER_SCRIPT} >> ${LOG_FILE} 2>&1 ${MARKER}"

{
    crontab -l 2>/dev/null | grep -v "${MARKER}" || true
    echo "$ENTRY"
} | crontab -

echo "[install-cron] installed cron entry:"
echo "$ENTRY"
