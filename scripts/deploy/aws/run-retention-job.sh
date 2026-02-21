#!/usr/bin/env bash
set -euo pipefail

export PATH="/usr/local/bin:/usr/bin:/bin:${PATH:-}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-${REPO_DIR}/deploy/aws/docker-compose.backend.prod.yml}"
ENV_FILE="${ENV_FILE:-${REPO_DIR}/deploy/aws/backend.env}"

if docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
    COMPOSE_CMD=(docker-compose)
else
    echo "[retention-job] ERROR: docker compose is not installed." >&2
    exit 1
fi

compose() {
    "${COMPOSE_CMD[@]}" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

# Ensure API service is available before maintenance execution.
compose up -d api >/dev/null

echo "[retention-job] running maintenance:cleanup-orders"
compose exec -T api npm run maintenance:cleanup-orders
echo "[retention-job] done"
