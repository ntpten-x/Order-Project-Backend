# POS Go-Live Performance Checklist

## 1) Pre-Go-Live Config
- [ ] Enable profile-equivalent settings in production env:
  - [ ] `TYPEORM_LOGGING=false`
  - [ ] `DATABASE_POOL_MAX=80`
  - [ ] `DATABASE_POOL_MIN=20`
  - [ ] `DATABASE_CONNECTION_TIMEOUT_MS=30000`
  - [ ] `DATABASE_IDLE_TIMEOUT_MS=30000`
  - [ ] `STATEMENT_TIMEOUT_MS=30000`
  - [ ] `RATE_LIMIT_MAX=100000` (or policy-equivalent for expected NAT/shared-IP traffic)
- [ ] Confirm DB `max_connections` supports app pool + admin/monitoring connections.
- [ ] Apply latest migrations and verify no pending migration on startup.
- [ ] Keep Redis/realtime service healthy; do not disable websocket/realtime paths.

## 2) Safety Validation (No Flow Regression)
- [ ] Run automated tests (unit/integration) for POS order create/update/payment/cancel flow.
- [ ] Verify realtime contracts still fire:
  - [ ] order create/update/cancel events
  - [ ] payment update events
  - [ ] table status update events
- [ ] Verify shift-required guard still works before POS sell flow.

## 3) Performance Validation Before Cutover
- [ ] Run deterministic read-heavy test:
  - [ ] `GO_LIVE_PROFILE=pos-production`
  - [ ] `GO_LIVE_K6_SCRIPT=load-tests/k6-pos-read-heavy.js`
  - [ ] `VUS=40 STAGE_UP=45s STAGE_STEADY=120s STAGE_DOWN=30s`
- [ ] Acceptance gate:
  - [ ] `http_req_failed < 2%`
  - [ ] `p95 < 2000ms`
  - [ ] `p99 < 3500ms`

## 4) Cutover Monitoring
- [ ] Monitor DB pool saturation (% waiting, timeout count).
- [ ] Monitor API p95/p99 for `/pos/orders*` and `/pos/orders/stats`.
- [ ] Monitor error classes: 429, 5xx, DB pool timeout, request timeout.
- [ ] Alert if p99 trend breaches SLO for >5 minutes.

## 5) Rollback Guardrails
- [ ] Keep previous env values documented for immediate rollback.
- [ ] If sustained p99 breach occurs:
  - [ ] reduce traffic/load per instance (scale out)
  - [ ] rollback pool/rate-limit tuning only if needed
  - [ ] do not roll back realtime event code blindly
