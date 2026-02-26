# POS Capacity Report (2026-02-26)

## Scope
- System: `Order-Project-Backend` + `Order-Project-Frontend`
- Test type: POS read-heavy (`/pos/orders`, `/pos/orders/summary`, `/pos/orders/stats`, `/health`)
- Test runner: `node scripts/go-live-phase4.js` + `load-tests/k6-pos-read-heavy.js`
- Pass criteria:
  - `http_req_failed < 2%`
  - `http_req_duration p95 < 2000ms`
  - `http_req_duration p99 < 3500ms`

## Production Profile Used
- `GO_LIVE_PROFILE=pos-production`
- Effective tuned baseline:
  - `DATABASE_POOL_MAX=80`
  - `DATABASE_POOL_MIN=20`
  - `RATE_LIMIT_MAX=100000`
  - `TYPEORM_LOGGING=false`

## Results Summary
| Scenario | VUs | p95 | p99 | Error rate | Req/s | Result | Summary file |
|---|---:|---:|---:|---:|---:|---|---|
| Standard | 22 | 501ms | 736ms | 0.00% | 86.94 | PASS | `load-tests/k6-pos-read-summary-v22-profile-rerun-p80-std.json` |
| Standard | 32 | 265ms | 439ms | 0.00% | 162.87 | PASS | `load-tests/k6-pos-read-summary-v32-profile-rerun-p80-std.json` |
| Standard | 40 | 299ms | 440ms | 0.00% | 196.30 | PASS | `load-tests/k6-pos-read-summary-v40-profile-rerun-p80-std.json` |
| Soak (120s steady) | 40 | 268ms | 500ms | 0.00% | 206.37 | PASS | `load-tests/k6-pos-read-summary-v40-profile-rerun-p80-soak.json` |
| Standard | 60 | 1756ms | 11518ms | 1.32% | 105.69 | FAIL (p99) | `load-tests/k6-pos-read-summary-v60-profile-rerun-p80-std.json` |

## Capacity Decision
- Safe concurrent users (sustained): **40 VUs**
- Headroom before threshold break: tested up to **60 VUs** and failed at p99, so practical headroom is **between 40 and 60 VUs**.
- Conservative go-live recommendation: run at **<= 40 concurrent active POS users per backend instance** for stable p95/p99 and 0% errors in this profile.

## Notes
- Pool tuning materially improved sustained performance:
  - Previous 40-VU soak with lower pool settings failed p95/p99.
  - With `DATABASE_POOL_MAX=80` and `DATABASE_POOL_MIN=20`, 40-VU soak passed comfortably.
- Realtime flow was not modified by these load-test profile parameters.
