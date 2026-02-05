# Order Retention / Auto Cleanup (30 days)

This backend includes a maintenance script to automatically delete **closed** POS orders older than a configured retention period (default **30 days**).

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
0 3 * * * cd /srv/Order-Project-Backend && ORDER_RETENTION_ENABLED=true npm run maintenance:cleanup-orders >> /var/log/order-retention.log 2>&1
```

Windows Task Scheduler example (Action: Start a program):

- Program: `cmd.exe`
- Arguments: `/c "cd /d E:\Project\Order-Project-Backend && set ORDER_RETENTION_ENABLED=true && npm run maintenance:cleanup-orders"`

## Safety

- Deletes only occur when `ORDER_RETENTION_ENABLED=true`. Otherwise the job runs in **dry-run** mode and only reports how many orders would be eligible.
- Use `ORDER_RETENTION_DRY_RUN=true` to force dry-run even when enabled.

