#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${1:-/srv/Order-Project-Backend}"
CRON_SCHEDULE="${2:-0 3 * * *}"
LOG_FILE="${3:-${PROJECT_DIR}/logs/retention-cron.log}"

CMD="cd ${PROJECT_DIR} && ORDER_RETENTION_ENABLED=true ORDER_QUEUE_RETENTION_ENABLED=true npm run maintenance:cleanup-orders >> ${LOG_FILE} 2>&1"
ENTRY="${CRON_SCHEDULE} ${CMD}"

(crontab -l 2>/dev/null | grep -v "maintenance:cleanup-orders"; echo "${ENTRY}") | crontab -
echo "Installed retention cron job:"
echo "${ENTRY}"
