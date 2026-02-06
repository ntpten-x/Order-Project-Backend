# Secret Rotation Runbook

This runbook rotates secrets that were previously exposed and safely deploys replacements.

## 1) Generate new secrets

Run:

```bash
npm run security:generate-secrets
```

Use generated values for:

- `JWT_SECRET`
- `METRICS_API_KEY`

For Redis/Database credentials, rotate from your provider console (do not reuse old values).

## 2) Rotate external credentials

1. PostgreSQL / RDS:
- Change DB password.
- Update `DATABASE_PASSWORD` in deployment secrets.
- Restart backend with new env.

2. Redis:
- Rotate Redis password/token.
- Update:
  - `REDIS_URL`
  - `RATE_LIMIT_REDIS_URL`
- Restart backend.

3. Metrics endpoint key:
- Set new `METRICS_API_KEY` in backend environment.
- Update monitoring caller header `x-metrics-key`.

## 3) Rotate application signing secret

1. Set new `JWT_SECRET` in backend environment.
2. Restart all backend instances.
3. Force logout all users (old JWT should no longer be valid).

## 4) Invalidate active sessions

Because sessions are stored in Redis by `jti`, clear old session keys:

```bash
redis-cli -u "$REDIS_URL" --scan --pattern "order-app:session:*" | xargs redis-cli -u "$REDIS_URL" del
```

Windows PowerShell example:

```powershell
redis-cli -u $env:REDIS_URL --scan --pattern "order-app:session:*" | ForEach-Object { redis-cli -u $env:REDIS_URL DEL $_ }
```

## 5) Verify after deployment

1. Login/logout works.
2. `/auth/me` returns 200 for fresh login.
3. Socket reconnect works.
4. `/metrics` requires new `x-metrics-key` (if enabled).
5. Retention job still runs and writes `logs/retention-jobs.log`.

## 6) Prevent recurrence

1. Keep `.env.example` with placeholders only.
2. Store real secrets only in secret manager / deployment env.
3. Add a pre-commit secret scanner (e.g. Gitleaks).
