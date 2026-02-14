# Production Setup (Copy-Run): POS 30 วัน + Stock 7 วัน

ไฟล์นี้เป็นคำสั่งแบบคัดลอกไปรันได้ทันที สำหรับเครื่องใหม่

## Windows (PowerShell)

1. เข้าโฟลเดอร์โปรเจกต์

```powershell
cd E:\Project\Order-Project-Backend
```

2. ตั้งค่า env retention (ถาวรที่ระดับเครื่อง)

```powershell
[Environment]::SetEnvironmentVariable("ORDER_RETENTION_ENABLED","true","Machine")
[Environment]::SetEnvironmentVariable("ORDER_QUEUE_RETENTION_ENABLED","true","Machine")
[Environment]::SetEnvironmentVariable("ORDER_RETENTION_DAYS","30","Machine")
[Environment]::SetEnvironmentVariable("ORDER_RETENTION_DRY_RUN","false","Machine")
[Environment]::SetEnvironmentVariable("STOCK_ORDER_RETENTION_ENABLED","true","Machine")
[Environment]::SetEnvironmentVariable("STOCK_ORDER_RETENTION_DAYS","7","Machine")
[Environment]::SetEnvironmentVariable("STOCK_ORDER_RETENTION_STATUSES","completed","Machine")
[Environment]::SetEnvironmentVariable("STOCK_ORDER_RETENTION_DRY_RUN","false","Machine")
[Environment]::SetEnvironmentVariable("AUDIT_LOG_RETENTION_ENABLED","true","Machine")
[Environment]::SetEnvironmentVariable("AUDIT_LOG_RETENTION_DAYS","7","Machine")
[Environment]::SetEnvironmentVariable("AUDIT_LOG_RETENTION_DRY_RUN","false","Machine")
[Environment]::SetEnvironmentVariable("RETENTION_LOG_FILE","logs/retention-jobs.log","Machine")
```

3. ทดสอบรันงาน 1 รอบ

```powershell
npm ci
npm run migration:run
npm run maintenance:cleanup-orders:dev
```

4. ติดตั้ง Scheduled Task (ทุกวัน 03:00)

```powershell
powershell -ExecutionPolicy Bypass -File scripts/maintenance/install-retention-task.ps1 -TaskName "OrderRetentionCleanupDaily" -ProjectDir "E:\Project\Order-Project-Backend" -Time "03:00"
```

5. ตรวจสอบและสั่งรันทันที

```powershell
schtasks /Query /TN "OrderRetentionCleanupDaily" /V /FO LIST
Start-ScheduledTask -TaskName "OrderRetentionCleanupDaily"
Start-Sleep -Seconds 15
Get-ScheduledTaskInfo -TaskName "OrderRetentionCleanupDaily" | Select-Object LastRunTime,LastTaskResult,NextRunTime
Get-Content E:\Project\Order-Project-Backend\logs\retention-jobs.log | Select-Object -Last 5
```

ผลที่ต้องได้:

- `LastTaskResult = 0`
- log มี `[Retention][Summary]` และมี key `stockOrders`

## Linux (bash)

1. เข้าโฟลเดอร์โปรเจกต์

```bash
cd /srv/Order-Project-Backend
```

2. ตั้งค่า env ใน systemd service หรือ `/etc/environment` (ตัวอย่าง export ชั่วคราว)

```bash
export ORDER_RETENTION_ENABLED=true
export ORDER_QUEUE_RETENTION_ENABLED=true
export ORDER_RETENTION_DAYS=30
export ORDER_RETENTION_DRY_RUN=false
export STOCK_ORDER_RETENTION_ENABLED=true
export STOCK_ORDER_RETENTION_DAYS=7
export STOCK_ORDER_RETENTION_STATUSES=completed
export STOCK_ORDER_RETENTION_DRY_RUN=false
export AUDIT_LOG_RETENTION_ENABLED=true
export AUDIT_LOG_RETENTION_DAYS=7
export AUDIT_LOG_RETENTION_DRY_RUN=false
export RETENTION_LOG_FILE=logs/retention-jobs.log
```

3. ทดสอบรันงาน 1 รอบ

```bash
npm ci
npm run build
npm run migration:run
npm run maintenance:cleanup-orders
```

4. ติดตั้ง cron (ทุกวัน 03:00)

```bash
bash scripts/maintenance/install-retention-cron.sh /srv/Order-Project-Backend "0 3 * * *" /srv/Order-Project-Backend/logs/retention-cron.log
```

5. ตรวจสอบ

```bash
crontab -l | grep maintenance:cleanup-orders
tail -n 20 /srv/Order-Project-Backend/logs/retention-jobs.log
```
