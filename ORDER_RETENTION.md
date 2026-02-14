# Order Retention / Auto Cleanup

This backend includes a maintenance script to automatically delete:

- closed POS orders older than a configured retention period (default **30 days**)
- completed stock orders older than a configured retention period (default **7 days**)
- audit logs older than a configured retention period (default **7 days**)

## What will be deleted

When the job runs, it finds rows in `sales_orders` where:

- `status` is in `ORDER_RETENTION_STATUSES` (default: `Paid,Completed,Cancelled,completed,cancelled`)
- `create_date` is older than `ORDER_RETENTION_DAYS` days (default: `30`)

Then it deletes related rows in this order:

1. `order_queue`
2. `payments`
3. `sales_order_detail`
4. `sales_order_item`
5. `sales_orders`

It also cleans stock purchase history from `stock_orders` where:

- `status` is in `STOCK_ORDER_RETENTION_STATUSES` (default: `completed`)
- `create_date` is older than `STOCK_ORDER_RETENTION_DAYS` days (default: `7`)

Then it deletes related rows in this order:

1. `stock_orders_detail`
2. `stock_orders_item`
3. `stock_orders`

It also cleans audit history from `audit_logs` where:

- `created_at` is older than `AUDIT_LOG_RETENTION_DAYS` days (default: `7`)

## How to run manually

Development (TypeScript via `ts-node`):

- `npm run maintenance:cleanup-orders:dev`

Production (compiled JS):

- `npm run build`
- `npm run maintenance:cleanup-orders`

## Scheduling (cron / Task Scheduler)

The recommended setup is to run the script once per day during off-peak hours (e.g. 03:00).

Linux cron example (runs daily at 03:00):

```cron
0 3 * * * cd /srv/Order-Project-Backend && ORDER_RETENTION_ENABLED=true ORDER_QUEUE_RETENTION_ENABLED=true STOCK_ORDER_RETENTION_ENABLED=true AUDIT_LOG_RETENTION_ENABLED=true npm run maintenance:cleanup-orders >> /var/log/order-retention.log 2>&1
```

Windows Task Scheduler example (Action: Start a program):

- Program: `cmd.exe`
- Arguments: `/c "cd /d E:\Project\Order-Project-Backend && set ORDER_RETENTION_ENABLED=true && set ORDER_QUEUE_RETENTION_ENABLED=true && set STOCK_ORDER_RETENTION_ENABLED=true && set AUDIT_LOG_RETENTION_ENABLED=true && npm run maintenance:cleanup-orders"`

You can install schedules with helper scripts:

- Linux: `bash scripts/maintenance/install-retention-cron.sh`
- Windows (PowerShell): `.\scripts\maintenance\install-retention-task.ps1`

## Monitoring the deletion result

Each run writes a structured JSON summary to:

- `RETENTION_LOG_FILE` (default: `logs/retention-jobs.log`)

Useful env vars:

- `RETENTION_WARN_DELETED_TOTAL` (default: `5000`) logs warning when total deleted rows in one run exceed threshold.
- `ORDER_RETENTION_ENABLED` / `ORDER_QUEUE_RETENTION_ENABLED` / `STOCK_ORDER_RETENTION_ENABLED` / `AUDIT_LOG_RETENTION_ENABLED` must be `true` to delete data.

## Safety

- Deletes only occur when `ORDER_RETENTION_ENABLED=true`. Otherwise the job runs in **dry-run** mode and only reports how many orders would be eligible.
- Use `ORDER_RETENTION_DRY_RUN=true` to force dry-run even when enabled.
- Stock order cleanup defaults to `ORDER_RETENTION_ENABLED` when `STOCK_ORDER_RETENTION_ENABLED` is omitted.
- Audit-log cleanup defaults to `ORDER_RETENTION_ENABLED` when `AUDIT_LOG_RETENTION_ENABLED` is omitted.
