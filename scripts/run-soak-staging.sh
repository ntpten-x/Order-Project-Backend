#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-}"
if [[ -z "$BASE_URL" ]]; then
  echo "[soak] BASE_URL is required, e.g. BASE_URL=https://api-staging.example.com" >&2
  exit 1
fi

DURATION="${DURATION:-2h}"
VUS="${VUS:-20}"
THINK_TIME_SECONDS="${THINK_TIME_SECONDS:-0.5}"
METRICS_KEY="${METRICS_KEY:-}"
SOAK_MAX_ERROR_RATE="${SOAK_MAX_ERROR_RATE:-0.02}"
SOAK_MAX_P95_MS="${SOAK_MAX_P95_MS:-250}"
SOAK_MAX_P99_MS="${SOAK_MAX_P99_MS:-1000}"
SOAK_MAX_TIMEOUTS="${SOAK_MAX_TIMEOUTS:-0}"
SOAK_MAX_5XX="${SOAK_MAX_5XX:-0}"

OUT="${OUT:-soak-artifacts/$(date +%Y%m%d-%H%M%S)}"
mkdir -p "$OUT"

LOG_PID=""
ERR_PID=""
cleanup() {
  if [[ -n "$LOG_PID" ]]; then
    kill "$LOG_PID" 2>/dev/null || true
  fi
  if [[ -n "$ERR_PID" ]]; then
    kill "$ERR_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

echo "[soak] output dir: $OUT"
echo "[soak] preflight health: $BASE_URL/health"
curl -fsS "$BASE_URL/health" > /dev/null

if [[ "${CAPTURE_DOCKER_API_LOGS:-0}" == "1" ]]; then
  COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
  echo "[soak] capturing docker api logs from $COMPOSE_FILE"
  docker compose -f "$COMPOSE_FILE" logs -f api > "$OUT/api.log" 2>&1 &
  LOG_PID=$!
fi

if [[ -n "${ERROR_LOG_CMD:-}" ]]; then
  echo "[soak] capturing external error logs via ERROR_LOG_CMD"
  bash -lc "$ERROR_LOG_CMD" > "$OUT/error.log" 2>&1 &
  ERR_PID=$!
fi

echo "[soak] running k6 duration=$DURATION vus=$VUS"
k6 run \
  -e BASE_URL="$BASE_URL" \
  -e DURATION="$DURATION" \
  -e VUS="$VUS" \
  -e THINK_TIME_SECONDS="$THINK_TIME_SECONDS" \
  --summary-export "$OUT/k6-summary.json" \
  load-tests/k6-go-live-smoke.js | tee "$OUT/k6.log"

if [[ -n "$METRICS_KEY" ]]; then
  curl -fsS -H "x-metrics-key: $METRICS_KEY" "$BASE_URL/metrics" > "$OUT/metrics-final.prom" || true
else
  curl -fsS "$BASE_URL/metrics" > "$OUT/metrics-final.prom" || true
fi

echo "[soak] reviewing error budget"
SOAK_MAX_ERROR_RATE="$SOAK_MAX_ERROR_RATE" \
SOAK_MAX_P95_MS="$SOAK_MAX_P95_MS" \
SOAK_MAX_P99_MS="$SOAK_MAX_P99_MS" \
SOAK_MAX_TIMEOUTS="$SOAK_MAX_TIMEOUTS" \
SOAK_MAX_5XX="$SOAK_MAX_5XX" \
node scripts/review-soak-artifacts.mjs "$OUT"

echo "[soak] done: $OUT"
