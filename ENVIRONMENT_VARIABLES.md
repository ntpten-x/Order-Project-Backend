# Environment Variables Documentation

## Required Variables

### Database Configuration
- `DATABASE_HOST` - PostgreSQL host (default: localhost)
- `DATABASE_PORT` - PostgreSQL port (default: 5432)
- `DATABASE_USER` - Database username
- `DATABASE_PASSWORD` - Database password
- `DATABASE_NAME` - Database name

### Security
- `JWT_SECRET` - Secret key for JWT token signing (REQUIRED in production)
- `SESSION_TIMEOUT_MS` - Session timeout in milliseconds (default: 28800000 = 8 hours)

### Server
- `PORT` - Server port (default: 4000)
- `NODE_ENV` - Environment mode (development/production)
- `FRONTEND_URL` - Frontend URL for CORS configuration
- `TRUST_PROXY_CHAIN` - Optional trusted proxy configuration for Express (`1`, `true`, hop count, or CIDR/IP list). Keep empty when no trusted proxy chain is present.

## Optional Variables

### Database Optimization
- `DATABASE_POOL_MAX` - Maximum connection pool size (default: 20)
- `DATABASE_POOL_MIN` - Minimum connection pool size (default: 5)
- `DATABASE_CONNECTION_TIMEOUT_MS` - Connection timeout (default: 30000)
- `DATABASE_IDLE_TIMEOUT_MS` - Idle connection timeout (default: 30000)
- `STATEMENT_TIMEOUT_MS` - SQL statement timeout (default: 30000)

### SSL Configuration
- `DATABASE_SSL` - Enable SSL for database (true/false)
- `DATABASE_SSL_REJECT_UNAUTHORIZED` - Reject unauthorized SSL certificates

### TypeORM
- `TYPEORM_SYNC` - Auto-sync database schema (false in production, true in development)

### RLS / Migrations Safety
- `RUN_MIGRATIONS_ON_START` - Auto-run TypeORM migrations on startup (true/false)
- `REQUIRE_NO_PENDING_MIGRATIONS` - Fail startup if there are pending migrations (true/false). Defaults to `true` in production.
- `ENFORCE_DB_ROLE_POLICY` - Enforce runtime DB role policy (`1`/`0`, default `1`). Blocks superuser/BYPASSRLS roles.
- `ALLOW_SUPERUSER_DB_ROLE` - Emergency override to allow superuser DB roles (`1` only when you intentionally accept reduced isolation)
- `ALLOW_BYPASSRLS` - Emergency override to allow `BYPASSRLS` DB role (`1` only when you intentionally accept reduced isolation)
- `BRANCH_BACKFILL_ID` - UUID branch id used by migrations to backfill legacy rows with `branch_id IS NULL` (recommended if you have >1 branch)
- `DEFAULT_BRANCH_ID` - Fallback UUID branch id for backfills (used if `BRANCH_BACKFILL_ID` is not set)

### Performance
- `REQUEST_BODY_LIMIT_MB` - Request body size limit in MB (default: 5)
- `ENABLE_PERF_LOG` - Enable performance logging (default: false)

### Table QR Ordering
- `TABLE_QR_TOKEN_BYTES` - Random bytes used to generate per-table QR tokens (default: 24, minimum: 16)
- `TABLE_QR_TOKEN_EXPIRE_DAYS` - Token lifetime in days (default: 365). Set `0` or negative to disable expiry.

### Redis
- `REDIS_URL` - Redis connection string (used for sessions/auth and as fallback for rate limiting)
- `REDIS_PREFIX` - Key prefix namespace (default: `order-app`)
- `REDIS_CACHE_ENABLED` - Enable Redis-backed cross-instance cache for `withCache` utilities (`true`/`false`)
- `REDIS_TLS` - Optional override for Redis TLS (`true`/`false`). Defaults based on URL scheme (`rediss://` enables TLS)
- `REDIS_TLS_REJECT_UNAUTHORIZED` - Optional override to reject unauthorized TLS certs (`true`/`false`)
- `REDIS_TLS_AUTO_FALLBACK` - If `true`, retries with TLS disabled on `ERR_SSL_WRONG_VERSION_NUMBER` (defaults to `true` in non-production)
- `REDIS_CONNECT_TIMEOUT_MS` - Optional Redis connect timeout in ms (default: 5000)
- `PERMISSION_CACHE_TTL_MS` - TTL for permission decision cache in milliseconds (default: 300000)
- `PERMISSION_CACHE_TTL_SECONDS` - TTL for permission decision cache in seconds (used when `PERMISSION_CACHE_TTL_MS` is not set)
- `PERMISSION_CACHE_SCAN_COUNT` - Redis scan batch size when invalidating permission decision keys (default: 200)
- `SOCKET_REDIS_ADAPTER_ENABLED` - Enable Socket.IO Redis adapter for multi-instance realtime fan-out (`true`/`false`)

### Rate Limiting (Redis)
- `RATE_LIMIT_REDIS_URL` - Redis connection string for distributed rate limiting (recommended in production)
- `RATE_LIMIT_REDIS_TLS` - Optional override for Redis TLS (`true`/`false`). Defaults based on URL scheme (`rediss://` enables TLS)
- `RATE_LIMIT_REDIS_TLS_REJECT_UNAUTHORIZED` - Optional override to reject unauthorized TLS certs (`true`/`false`)
- `RATE_LIMIT_REDIS_TLS_AUTO_FALLBACK` - If `true`, retries with TLS disabled on `ERR_SSL_WRONG_VERSION_NUMBER` (defaults to `true` in non-production)
- `RATE_LIMIT_REDIS_CONNECT_TIMEOUT_MS` - Optional Redis connect timeout in ms (default: 5000)
- `RATE_LIMIT_WINDOW_MS` - API rate limit window in ms (default: 900000)
- `RATE_LIMIT_MAX` - API max requests per window (default: 1000)
- `RATE_LIMIT_AUTH_WINDOW_MS` - Auth rate limit window in ms (default: 900000)
- `RATE_LIMIT_AUTH_MAX` - Auth max requests per window (default: 20)
- `RATE_LIMIT_ORDER_WINDOW_MS` - Order creation window in ms (default: 60000)
- `RATE_LIMIT_ORDER_MAX` - Order creation max per window (default: 30)
- `RATE_LIMIT_PAYMENT_WINDOW_MS` - Payment window in ms (default: 300000)
- `RATE_LIMIT_PAYMENT_MAX` - Payment max per window (default: 50)
- `RATE_LIMIT_PASSWORD_RESET_WINDOW_MS` - Password reset window in ms (default: 3600000)
- `RATE_LIMIT_PASSWORD_RESET_MAX` - Password reset max per window (default: 5)

### Metrics (Prometheus)
- `METRICS_ENABLED` - Set to `true` to expose `/metrics`
- `METRICS_API_KEY` - Optional. If set, requests to `/metrics` must include header `x-metrics-key`

### Permission Access Review
- `ACCESS_REVIEW_MAX_STALE` - Default max stale override items allowed when running access review with enforcement (default: `0`)

### Data Retention (Orders)
- `ORDER_RETENTION_ENABLED` - Must be `true` to allow deletes (otherwise the job runs in dry-run mode)
- `ORDER_RETENTION_DAYS` - Delete closed orders older than N days when running the retention job (default: 30)
- `ORDER_RETENTION_STATUSES` - Comma-separated `sales_orders.status` values eligible for deletion (default: `Paid,Completed,Cancelled,completed,cancelled`)
- `ORDER_RETENTION_BATCH_SIZE` - Max orders deleted per batch (default: 500)
- `ORDER_RETENTION_MAX_BATCHES` - Max batches per run (default: 50)
- `ORDER_RETENTION_DRY_RUN` - If `true`, only counts eligible orders and does not delete (default: false)
- `ORDER_QUEUE_RETENTION_ENABLED` - Must be `true` to delete queue rows during retention runs
- `ORDER_QUEUE_RETENTION_DAYS` - Delete queue rows older than N days (default: 7)
- `ORDER_QUEUE_RETENTION_STATUSES` - Comma-separated `order_queue.status` values eligible for deletion
- `ORDER_QUEUE_RETENTION_DRY_RUN` - If `true`, queue cleanup only counts and does not delete
- `STOCK_ORDER_RETENTION_ENABLED` - Must be `true` to allow stock-order history deletes (defaults to `ORDER_RETENTION_ENABLED` when omitted)
- `STOCK_ORDER_RETENTION_DAYS` - Delete completed stock orders older than N days (default: 7)
- `STOCK_ORDER_RETENTION_STATUSES` - Comma-separated `stock_orders.status` values eligible for deletion (default: `completed`)
- `STOCK_ORDER_RETENTION_BATCH_SIZE` - Max stock orders deleted per batch (default: 500)
- `STOCK_ORDER_RETENTION_MAX_BATCHES` - Max stock-order batches per run (default: 50)
- `STOCK_ORDER_RETENTION_DRY_RUN` - If `true`, stock-order cleanup only counts and does not delete
- `AUDIT_LOG_RETENTION_ENABLED` - Must be `true` to allow audit-log deletes (defaults to `ORDER_RETENTION_ENABLED` when omitted)
- `AUDIT_LOG_RETENTION_DAYS` - Delete audit logs older than N days (default: 7)
- `AUDIT_LOG_RETENTION_BATCH_SIZE` - Max audit-log rows deleted per batch (default: 1000)
- `AUDIT_LOG_RETENTION_MAX_BATCHES` - Max audit-log batches per run (default: 100)
- `AUDIT_LOG_RETENTION_DRY_RUN` - If `true`, audit-log cleanup only counts and does not delete
- `RETENTION_LOG_FILE` - Path to JSONL log file for retention run summaries (default: `logs/retention-jobs.log`)
- `RETENTION_WARN_DELETED_TOTAL` - Warn threshold when one run deletes too many rows (default: 5000)

## Monitoring Services (Optional)

### Sentry (Error Tracking)
```env
SENTRY_DSN=your-sentry-dsn-here
SENTRY_ENVIRONMENT=production
```

### DataDog (Monitoring & APM)
```env
DATADOG_API_KEY=your-datadog-api-key
DATADOG_APP_KEY=your-datadog-app-key
DATADOG_SITE=datadoghq.com
```

### Custom Monitoring
```env
MONITORING_ENDPOINT=https://your-monitoring-service.com/api/events
```

## Setup Instructions

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Update the required variables with your actual values

3. **IMPORTANT**: In production, ensure:
   - `JWT_SECRET` is a strong, random string
   - `NODE_ENV=production`
   - `TYPEORM_SYNC=false`
   - `DATABASE_SSL=true` (if using remote database)
   - All sensitive values are kept secure

4. For monitoring services, add the appropriate API keys if you want to use external monitoring

## Security Notes

- Never commit `.env` files to version control
- Use strong, random values for `JWT_SECRET` in production
- Rotate secrets regularly
- Use environment-specific configurations
- Consider using secret management services (AWS Secrets Manager, HashiCorp Vault, etc.) in production
