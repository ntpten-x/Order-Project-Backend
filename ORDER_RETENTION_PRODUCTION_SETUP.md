# คู่มือเซ็ต Production: ลบประวัติออเดอร์อัตโนมัติ (Retention 30 วัน)

เอกสารนี้สรุปขั้นตอนตั้งค่าให้ระบบลบข้อมูลอัตโนมัติทำงานจริงบน Production

## 1) สิ่งที่ระบบจะลบ

ระบบจะลบเฉพาะออเดอร์ที่ปิดงานแล้ว และเก่ากว่าเวลาที่กำหนด

- ตารางหลัก: `sales_orders`
- สถานะที่เข้าเงื่อนไข (ค่าเริ่มต้น): `Paid,Completed,Cancelled,completed,cancelled`
- อายุข้อมูล (ค่าเริ่มต้น): `30` วัน
- ลบข้อมูลลูกที่เกี่ยวข้องก่อน เช่น `payments`, `sales_order_item`, `sales_order_detail`, `order_queue`

## 2) Environment Variables ที่ต้องตั้งบน Production

ตั้งค่าในไฟล์ env ของ backend (หรือ environment ของ process manager/container)

```env
ORDER_RETENTION_ENABLED=true
ORDER_QUEUE_RETENTION_ENABLED=true
ORDER_RETENTION_DAYS=30
ORDER_RETENTION_DRY_RUN=false
RETENTION_LOG_FILE=logs/retention-jobs.log
RETENTION_WARN_DELETED_TOTAL=5000
```

หมายเหตุ:

- ถ้า `ORDER_RETENTION_ENABLED` ไม่เป็น `true` ระบบจะเป็นโหมด dry-run (ไม่ลบจริง)
- ถ้า production DB ไม่ได้ชี้ใน `.env` เดียวกับแอป ให้ตั้ง `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_SSL` เพิ่มด้วย

## 3) ทดสอบ Manual ครั้งแรกก่อนเปิดอัตโนมัติ

รันที่เครื่อง/เซิร์ฟเวอร์ backend:

```powershell
cd E:\Project\Order-Project-Backend
npm run maintenance:cleanup-orders:dev
```

ถ้าเป็น production build:

```powershell
cd E:\Project\Order-Project-Backend
npm run build
npm run maintenance:cleanup-orders
```

ต้องเห็น log สรุปลักษณะนี้:

- `enabled: true`
- `dryRun: false`
- `[Retention][Summary] ... "status":"success"`

## 4) ตั้งงานอัตโนมัติ (Scheduler)

### 4.1 Windows (แนะนำ)

มีสคริปต์ให้ใช้:

```powershell
cd E:\Project\Order-Project-Backend
.\scripts\maintenance\install-retention-task.ps1 -TaskName "OrderRetentionCleanupDaily" -Time "03:00"
```

สคริปต์จะสร้างงานชื่อ `OrderRetentionCleanupDaily` ให้รันทุกวันเวลา 03:00

ตรวจสอบ:

```powershell
schtasks /Query /TN "OrderRetentionCleanupDaily" /V /FO LIST
```

ทดสอบรันทันที:

```powershell
Start-ScheduledTask -TaskName "OrderRetentionCleanupDaily"
Start-Sleep -Seconds 15
Get-ScheduledTaskInfo -TaskName "OrderRetentionCleanupDaily" | Select-Object LastRunTime,LastTaskResult,NextRunTime
```

ค่าที่ควรได้:

- `LastTaskResult = 0`

### 4.2 Linux (cron)

เพิ่ม cron:

```cron
0 3 * * * cd /srv/Order-Project-Backend && ORDER_RETENTION_ENABLED=true ORDER_QUEUE_RETENTION_ENABLED=true npm run maintenance:cleanup-orders >> /var/log/order-retention.log 2>&1
```

## 5) ยืนยันว่า “ทำงานอัตโนมัติจริง”

หลังตั้ง schedule แล้ว ตรวจ 3 จุดนี้:

1. Scheduler ขึ้นสถานะ `Ready` และมี `Next Run Time`
2. หลังรันแล้ว `LastTaskResult = 0`
3. มีบรรทัดล่าสุดใน `logs/retention-jobs.log` และ `status` เป็น `success`

ตัวอย่างตรวจ log:

```powershell
Get-Content E:\Project\Order-Project-Backend\logs\retention-jobs.log | Select-Object -Last 5
```

## 6) Troubleshooting ที่เจอบ่อย

### ปัญหา: `LastTaskResult` ไม่ใช่ 0

- เปิด log retention และตรวจ error ที่ท้ายไฟล์
- ตรวจว่า DB host/port ถูกต้อง
- ตรวจว่า npm/node ใช้งานได้ภายใต้ user ที่ task ใช้รัน

### ปัญหา: งานไม่รันเมื่อไม่มีคนล็อกอิน (Windows)

- ต้องสร้าง task ด้วยสิทธิ์สูง (Run as Administrator) และกำหนดบัญชีให้รันแบบ background ได้
- ถ้าจำเป็นให้สร้าง task เป็น `SYSTEM` โดยใช้ PowerShell/Admin หรือ Group Policy ตามนโยบายองค์กร

### ปัญหา: ลบไม่เกิดขึ้นเลย

- ตรวจว่า `ORDER_RETENTION_ENABLED=true`
- ตรวจว่า `ORDER_RETENTION_DRY_RUN=false`
- ตรวจว่ามีข้อมูลที่เข้าเงื่อนไขอายุเกิน 30 วันจริง

## 7) Checklist ก่อน Go-live

- [ ] ตั้ง env ครบตามหัวข้อ 2
- [ ] ทดสอบ manual แล้วได้ `status: success`
- [ ] ติดตั้ง scheduler แล้ว
- [ ] ทดสอบ run-now แล้ว `LastTaskResult = 0`
- [ ] ตรวจ log ล่าสุดมี summary success
- [ ] บันทึกวิธี rollback/disable งานชั่วคราว (เช่นปิด task หรือ `ORDER_RETENTION_ENABLED=false`)

---

## Update: Stock Order Auto Cleanup (7 days)

If you also want automatic cleanup for Stock order history (`stock_orders`) on production, add:

```env
STOCK_ORDER_RETENTION_ENABLED=true
STOCK_ORDER_RETENTION_DAYS=7
STOCK_ORDER_RETENTION_STATUSES=completed
STOCK_ORDER_RETENTION_DRY_RUN=false
```

Optional tuning:

```env
STOCK_ORDER_RETENTION_BATCH_SIZE=500
STOCK_ORDER_RETENTION_MAX_BATCHES=50
```

Scheduler command must include stock flag as well:

- Linux cron: add `STOCK_ORDER_RETENTION_ENABLED=true`
- Windows task: ensure runner exports `STOCK_ORDER_RETENTION_ENABLED=true`

## Update: Audit Log Auto Cleanup (7 days)

If you also want automatic cleanup for audit logs (`audit_logs`) on production, add:

```env
AUDIT_LOG_RETENTION_ENABLED=true
AUDIT_LOG_RETENTION_DAYS=7
AUDIT_LOG_RETENTION_DRY_RUN=false
```

Optional tuning:

```env
AUDIT_LOG_RETENTION_BATCH_SIZE=1000
AUDIT_LOG_RETENTION_MAX_BATCHES=100
```

Scheduler command must include audit flag as well:

- Linux cron: add `AUDIT_LOG_RETENTION_ENABLED=true`
- Windows task: ensure runner exports `AUDIT_LOG_RETENTION_ENABLED=true`
