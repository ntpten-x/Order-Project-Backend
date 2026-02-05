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
- `ALLOW_BYPASSRLS` - Allow database roles with `BYPASSRLS` (set to `1` to override startup safety check)
- `BRANCH_BACKFILL_ID` - UUID branch id used by migrations to backfill legacy rows with `branch_id IS NULL` (recommended if you have >1 branch)
- `DEFAULT_BRANCH_ID` - Fallback UUID branch id for backfills (used if `BRANCH_BACKFILL_ID` is not set)

### Performance
- `REQUEST_BODY_LIMIT_MB` - Request body size limit in MB (default: 5)
- `ENABLE_PERF_LOG` - Enable performance logging (default: false)

### Data Retention (Orders)
- `ORDER_RETENTION_ENABLED` - Must be `true` to allow deletes (otherwise the job runs in dry-run mode)
- `ORDER_RETENTION_DAYS` - Delete closed orders older than N days when running the retention job (default: 30)
- `ORDER_RETENTION_STATUSES` - Comma-separated `sales_orders.status` values eligible for deletion (default: `Paid,Completed,Cancelled,completed,cancelled`)
- `ORDER_RETENTION_BATCH_SIZE` - Max orders deleted per batch (default: 500)
- `ORDER_RETENTION_MAX_BATCHES` - Max batches per run (default: 50)
- `ORDER_RETENTION_DRY_RUN` - If `true`, only counts eligible orders and does not delete (default: false)

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
