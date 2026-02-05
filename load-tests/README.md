# Load Tests (k6)

## Quick Start
1. Install k6.
2. Run the script from the backend root:

```bash
k6 run -e BASE_URL=http://localhost:3000 -e USERNAME=admin -e PASSWORD=secret load-tests/k6-stock-orders.js
```

## Notes
- `BASE_URL` should point to the backend origin (not the frontend).
- If `USERNAME`/`PASSWORD` are not provided, the script will still hit `/health` but protected endpoints may return `401`.
- `/csrf-token` is used to fetch a CSRF token when cookie auth is enabled.

## Tuning
- Adjust the `stages` and `thresholds` inside `k6-stock-orders.js`.
