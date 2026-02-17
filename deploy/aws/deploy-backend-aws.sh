#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

REPO_URL="${REPO_URL:-https://github.com/ntpten-x/Order-Project-Backend.git}"
BRANCH="${BRANCH:-master}"
SKIP_GIT_PULL="${SKIP_GIT_PULL:-0}"
INSTALL_CRON="${INSTALL_CRON:-1}"
CRON_SCHEDULE="${CRON_SCHEDULE:-0 3 * * *}"
USE_LOCAL_POSTGRES="${USE_LOCAL_POSTGRES:-auto}"
USE_LOCAL_REDIS="${USE_LOCAL_REDIS:-auto}"

COMPOSE_FILE="${COMPOSE_FILE:-${SCRIPT_DIR}/docker-compose.backend.prod.yml}"
ENV_FILE="${ENV_FILE:-${SCRIPT_DIR}/backend.env}"
CRON_INSTALL_SCRIPT="${CRON_INSTALL_SCRIPT:-${REPO_DIR}/scripts/deploy/aws/install-backend-cron.sh}"

log() {
    printf '[deploy-backend] %s\n' "$*"
}

fail() {
    printf '[deploy-backend] ERROR: %s\n' "$*" >&2
    exit 1
}

require_cmd() {
    command -v "$1" >/dev/null 2>&1 || fail "Missing command: $1"
}

require_cmd git
require_cmd docker

if docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
    COMPOSE_CMD=(docker-compose)
else
    fail "Missing Docker Compose. Install docker compose plugin or docker-compose."
fi

compose() {
    "${COMPOSE_CMD[@]}" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

if [[ ! -f "$COMPOSE_FILE" ]]; then
    fail "Compose file not found: $COMPOSE_FILE"
fi

if [[ ! -f "$ENV_FILE" ]]; then
    if [[ -f "${SCRIPT_DIR}/backend.env.example" ]]; then
        cp "${SCRIPT_DIR}/backend.env.example" "$ENV_FILE"
    fi
    fail "Env file missing. Updated template has been copied to: $ENV_FILE"
fi

set -o allexport
# shellcheck disable=SC1090
source "$ENV_FILE"
set +o allexport

if [[ -z "${DATABASE_PASSWORD:-}" || "${DATABASE_PASSWORD}" == *"CHANGE_ME"* ]]; then
    fail "DATABASE_PASSWORD must be set in $ENV_FILE"
fi

if [[ -z "${JWT_SECRET:-}" || "${JWT_SECRET}" == *"CHANGE_ME"* ]]; then
    fail "JWT_SECRET must be set in $ENV_FILE"
fi

if [[ -z "${BOOTSTRAP_ADMIN_USERNAME:-}" || -z "${BOOTSTRAP_ADMIN_PASSWORD:-}" ]]; then
    fail "Set BOOTSTRAP_ADMIN_USERNAME and BOOTSTRAP_ADMIN_PASSWORD in $ENV_FILE"
fi

infer_use_local_postgres() {
    if [[ "$USE_LOCAL_POSTGRES" == "true" || "$USE_LOCAL_POSTGRES" == "false" ]]; then
        echo "$USE_LOCAL_POSTGRES"
        return
    fi
    if [[ "${DATABASE_HOST:-}" == "postgres" || "${DATABASE_HOST:-}" == "localhost" || -z "${DATABASE_HOST:-}" ]]; then
        echo "true"
    else
        echo "false"
    fi
}

infer_use_local_redis() {
    if [[ "$USE_LOCAL_REDIS" == "true" || "$USE_LOCAL_REDIS" == "false" ]]; then
        echo "$USE_LOCAL_REDIS"
        return
    fi
    if [[ "${REDIS_URL:-}" == "redis://redis:6379" || "${REDIS_URL:-}" == "redis://localhost:6379" || -z "${REDIS_URL:-}" ]]; then
        echo "true"
    else
        echo "false"
    fi
}

LOCAL_POSTGRES_ENABLED="$(infer_use_local_postgres)"
LOCAL_REDIS_ENABLED="$(infer_use_local_redis)"
SERVICES_TO_START=()
if [[ "$LOCAL_POSTGRES_ENABLED" == "true" ]]; then
    SERVICES_TO_START+=("postgres")
fi
if [[ "$LOCAL_REDIS_ENABLED" == "true" ]]; then
    SERVICES_TO_START+=("redis")
fi

if [[ "$SKIP_GIT_PULL" != "1" ]]; then
    log "Sync repository from ${REPO_URL} (${BRANCH})..."
    git -C "$REPO_DIR" remote set-url origin "$REPO_URL"
    git -C "$REPO_DIR" fetch origin "$BRANCH"
    git -C "$REPO_DIR" checkout "$BRANCH"
    git -C "$REPO_DIR" pull --ff-only origin "$BRANCH"
fi

if (( ${#SERVICES_TO_START[@]} > 0 )); then
    log "Starting local infra services: ${SERVICES_TO_START[*]}"
    compose up -d "${SERVICES_TO_START[@]}"
else
    log "Skipping local postgres/redis (using external services from env)."
fi

wait_for_health() {
    local container_name="$1"
    local timeout_sec="$2"
    local elapsed=0

    while (( elapsed < timeout_sec )); do
        local status
        status="$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_name" 2>/dev/null || true)"
        if [[ "$status" == "healthy" || "$status" == "running" ]]; then
            return 0
        fi
        sleep 2
        elapsed=$((elapsed + 2))
    done
    return 1
}

if [[ "$LOCAL_POSTGRES_ENABLED" == "true" ]]; then
    wait_for_health "order-backend-postgres" 120 || fail "Postgres not healthy in time."
fi
if [[ "$LOCAL_REDIS_ENABLED" == "true" ]]; then
    wait_for_health "order-backend-redis" 120 || fail "Redis not healthy in time."
fi

log "Building API image..."
compose build api

log "Checking environment variables..."
compose run --rm api npm run env:check

log "Running migration + seed bootstrap..."
compose run --rm api npm run db:migrate-seed:prod

log "Starting API service..."
compose up -d api
wait_for_health "order-backend-api" 180 || fail "API container not healthy in time."

API_PORT_VALUE="${API_PORT:-3000}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:${API_PORT_VALUE}/health}"
if command -v curl >/dev/null 2>&1; then
    curl -fsS "$HEALTH_URL" >/dev/null || fail "Health check failed: $HEALTH_URL"
elif command -v wget >/dev/null 2>&1; then
    wget -qO- "$HEALTH_URL" >/dev/null || fail "Health check failed: $HEALTH_URL"
else
    log "curl/wget not found; skip HTTP health probe. Container health check already passed."
fi

if [[ "$INSTALL_CRON" == "1" ]]; then
    [[ -f "$CRON_INSTALL_SCRIPT" ]] || fail "Cron installer script not found: $CRON_INSTALL_SCRIPT"
    log "Installing retention cron job (${CRON_SCHEDULE})..."
    bash "$CRON_INSTALL_SCRIPT" "$REPO_DIR" "$COMPOSE_FILE" "$ENV_FILE" "$CRON_SCHEDULE"
fi

log "Deploy completed successfully."
log "API health URL: $HEALTH_URL"
log "View logs: ${COMPOSE_CMD[*]} --env-file $ENV_FILE -f $COMPOSE_FILE logs -f api"
