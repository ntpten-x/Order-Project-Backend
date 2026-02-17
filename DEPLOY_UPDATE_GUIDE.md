# Deploy Update Guide (Backend -> Frontend)

เอกสารนี้คือขั้นตอน deploy เมื่อมีการอัปเดตโค้ด โดยเรียงลำดับ `Backend ก่อน` แล้ว `Frontend`  
รองรับรูปแบบที่ใช้อยู่จริง:
- Backend: `git pull + build/run` บน EC2
- Frontend: `pull image` จาก GHCR บน EC2 (ไม่ build บน AWS)

---

## 0) ข้อมูลที่ใช้
- EC2 Public IP: `13.239.29.168`
- Backend path บน EC2: `/srv/order-project/backend`
- Frontend path บน EC2: `/srv/order-project/frontend`
- Backend port: `3000`
- Frontend port: `3001`
- Backend branch: `master`
- Frontend branch: `master`

---

## 1) เข้าเครื่อง EC2
รันจากเครื่อง local:

```bash
ssh -i "e:/Project/pos-key.pem" ec2-user@13.239.29.168
```

ข้อควรระวัง:
- พิมพ์ command ทีละบรรทัดจริง ๆ
- อย่า copy output/prompt (`[ec2-user@...]$`) กลับไปรัน เพราะจะทำให้เกิด `command not found`

---

## 2) Deploy Backend (ทำก่อน)

### 2.1 ไปที่โฟลเดอร์ backend และอัปเดตโค้ด
```bash
cd /srv/order-project/backend
git fetch origin
git checkout master
git pull --ff-only origin master
```

### 2.2 ตรวจไฟล์ env production (ห้ามทับทิ้งโดยไม่ตั้งค่าใหม่)
ใช้ไฟล์เดิมที่ใช้งานจริงเป็นหลัก:

```bash
ls -la .env.production
```

ถ้าไฟล์ยังไม่มี:
```bash
cp .env.example .env.production
```

ค่าหลักที่ต้องถูกต้องใน `.env.production`:
- `NODE_ENV=production`
- `FRONTEND_URL=http://13.239.29.168:3001`
- `COOKIE_SECURE=false` (กรณีใช้งานผ่าน HTTP)
- `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME` (RDS จริง)
- `DATABASE_SSL=true`
- `TYPEORM_SYNC=false`
- `RUN_MIGRATIONS_ON_START=true`
- `REQUIRE_NO_PENDING_MIGRATIONS=true`
- `REDIS_URL` และ `RATE_LIMIT_REDIS_URL` เป็น Redis จริง

เช็คค่าเร็ว:
```bash
grep -E '^(FRONTEND_URL|COOKIE_SECURE|DATABASE_HOST|DATABASE_PORT|DATABASE_USER|DATABASE_NAME|DATABASE_SSL|TYPEORM_SYNC|RUN_MIGRATIONS_ON_START|REQUIRE_NO_PENDING_MIGRATIONS|REDIS_URL|RATE_LIMIT_REDIS_URL)=' .env.production
```

### 2.3 Build image backend ใหม่บน EC2
```bash
docker build -t order-backend:prod .
```

### 2.4 Restart backend container
```bash
docker rm -f order-backend 2>/dev/null || true
docker run -d \
  --name order-backend \
  --restart unless-stopped \
  --env-file .env.production \
  -p 3000:3000 \
  order-backend:prod
```

### 2.5 ตรวจผล backend
```bash
docker ps --filter "name=order-backend"
docker logs --tail=200 order-backend
curl -i http://127.0.0.1:3000/health
curl -i http://13.239.29.168:3000/health
```

คาดหวัง:
- `docker ps` ต้องเห็น `Up`
- `/health` ต้องได้ `HTTP/1.1 200 OK`

---

## 3) Retention Cron (ตรวจ/ตั้งครั้งเดียว แล้วใช้ยาว)

### 3.1 ติดตั้ง cron job
```bash
mkdir -p /srv/order-project/backend/logs
(crontab -l 2>/dev/null | grep -v "maintenance:cleanup-orders"; \
echo "0 3 * * * cd /srv/order-project/backend && docker exec order-backend npm run maintenance:cleanup-orders >> /srv/order-project/backend/logs/retention-cron.log 2>&1") | crontab -
crontab -l
```

### 3.2 ทดสอบ retention ทันที 1 รอบ
```bash
docker exec order-backend npm run maintenance:cleanup-orders
docker exec order-backend sh -lc "tail -n 50 /app/logs/retention-jobs.log"
```

---

## 4) Deploy Frontend แบบ Pull (หลัง Backend ผ่านแล้ว)
ดูขั้นตอนละเอียดในไฟล์:
- `../Order-Project-Frontend/DEPLOY_UPDATE_GUIDE.md`

สรุปสั้น:
1. Build + Push image จากเครื่อง local ไป GHCR
2. EC2 ทำ `docker pull` ตาม tag
3. Run `order-frontend` ด้วย `.env.production`

---

## 5) Post-Deploy Checklist
1. เปิด `http://13.239.29.168:3001`
2. ลบ cookie ของโดเมน `13.239.29.168` แล้ว login ใหม่
3. ทดสอบ flow สำคัญ:
   - login/logout
   - switch branch
   - create/update/delete (POST/PUT/DELETE)
   - หน้า Audit และหน้า POS
4. ตรวจ `Health-System` ว่าไม่มี warning สำคัญ

---

## 6) Rollback แบบเร็ว (Backend)
ถ้า release ใหม่มีปัญหา:
1. ใช้ image เก่าที่ยังมีอยู่ในเครื่อง
2. รัน container กลับด้วย tag เดิม

ตัวอย่าง:
```bash
docker images | head
docker rm -f order-backend
docker run -d \
  --name order-backend \
  --restart unless-stopped \
  --env-file .env.production \
  -p 3000:3000 \
  <OLD_BACKEND_IMAGE_TAG>
```

