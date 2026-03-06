# Load Tests (k6)

## POS Read-Heavy (Recommended)
Run deterministic backend + k6 with production-like profile:

```bash
GO_LIVE_PROFILE=pos-production \
GO_LIVE_K6_SCRIPT=load-tests/k6-pos-read-heavy.js \
GO_LIVE_K6_SUMMARY=load-tests/k6-pos-read-summary.json \
AUTH_TOKEN=<jwt> \
VUS=40 STAGE_UP=45s STAGE_STEADY=120s STAGE_DOWN=30s \
node scripts/go-live-phase4.js
```

## Profile Defaults (`pos-production`)
- `TYPEORM_LOGGING=false`
- `DATABASE_POOL_MAX=80`
- `DATABASE_POOL_MIN=20`
- `DATABASE_CONNECTION_TIMEOUT_MS=30000`
- `DATABASE_IDLE_TIMEOUT_MS=30000`
- `STATEMENT_TIMEOUT_MS=30000`
- `RATE_LIMIT_MAX=100000`

Environment values passed explicitly still override profile defaults.

## Thresholds (`k6-pos-read-heavy.js`)
- `http_req_failed < 2%`
- `http_req_duration p95 < 2000ms`
- `http_req_duration p99 < 3500ms`

## Notes
- Use backend origin for `BASE_URL` (not frontend).
- Prefer `AUTH_TOKEN` for stable load tests; login-per-VU adds extra auth noise.
