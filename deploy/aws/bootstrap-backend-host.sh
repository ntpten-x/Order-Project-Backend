#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/ntpten-x/Order-Project-Backend.git}"
BRANCH="${BRANCH:-master}"
APP_DIR="${APP_DIR:-/srv/order-project/backend}"
HOST_USER="${HOST_USER:-$USER}"

log() {
    printf '[bootstrap-backend] %s\n' "$*"
}

fail() {
    printf '[bootstrap-backend] ERROR: %s\n' "$*" >&2
    exit 1
}

if ! command -v sudo >/dev/null 2>&1; then
    fail "sudo is required."
fi

log "Installing prerequisites (git, docker, cron service)..."
if command -v dnf >/dev/null 2>&1; then
    sudo dnf install -y git docker cronie
elif command -v yum >/dev/null 2>&1; then
    sudo yum install -y git docker cronie
elif command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update
    sudo apt-get install -y git docker.io cron
else
    fail "Unsupported package manager. Install git/docker/cron manually."
fi

log "Enabling Docker and cron service..."
sudo systemctl enable --now docker
sudo systemctl enable --now crond 2>/dev/null || sudo systemctl enable --now cron

if ! id -nG "$HOST_USER" | tr ' ' '\n' | grep -qx docker; then
    log "Adding ${HOST_USER} to docker group..."
    sudo usermod -aG docker "$HOST_USER"
    log "Docker group updated. Re-login is required before running deploy scripts without sudo."
fi

log "Preparing repository directory: ${APP_DIR}"
sudo mkdir -p "$(dirname "$APP_DIR")"
sudo chown -R "$HOST_USER":"$HOST_USER" "$(dirname "$APP_DIR")"

if [[ ! -d "${APP_DIR}/.git" ]]; then
    git clone --branch "$BRANCH" --single-branch "$REPO_URL" "$APP_DIR"
else
    git -C "$APP_DIR" fetch origin "$BRANCH"
    git -C "$APP_DIR" checkout "$BRANCH"
    git -C "$APP_DIR" pull --ff-only origin "$BRANCH"
fi

if [[ ! -f "${APP_DIR}/deploy/aws/backend.env" ]]; then
    cp "${APP_DIR}/deploy/aws/backend.env.example" "${APP_DIR}/deploy/aws/backend.env"
    log "Created ${APP_DIR}/deploy/aws/backend.env from template."
fi

log "Bootstrap complete."
log "Next: edit ${APP_DIR}/deploy/aws/backend.env then run:"
log "bash ${APP_DIR}/deploy/aws/deploy-backend-aws.sh"
