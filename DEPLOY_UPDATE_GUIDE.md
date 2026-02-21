# Deploy Update Guide (Backend -> Frontend)

เอกสารนี้คือขั้นตอน deploy เมื่อมีการอัปเดตโค้ด โดยเรียงลำดับ `Backend ก่อน` แล้ว `Frontend`

รูปแบบนี้ **ห้าม build บน EC2 เด็ดขาด**:
- Local: build image ด้วย Docker แล้ว push ขึ้น GHCR
- EC2: `docker login` + `docker pull` + `docker compose up -d` เฉพาะ service

---

## 0) ข้อมูลที่ใช้
- EC2 Public IP: `54.255.216.29`
- Backend URL: `http://54.255.216.29:3000`
- Frontend URL: `http://54.255.216.29:3001`
- Backend image: `ghcr.io/ntpten-x/order-project-backend:latest`
- Frontend image: `ghcr.io/ntpten-x/order-project-frontend:latest`
- Backend branch: `master`
- Frontend branch: `master`
- Compose file บน EC2: `~/docker-compose.prod.yml`
- Env files บน EC2:
  - `~/backend.env`
  - `~/frontend.env`

Setup ครั้งแรกบน EC2 (ทำครั้งเดียว):
1. วาง `docker-compose.prod.yml` ไปที่ `~/docker-compose.prod.yml`
2. สร้าง `~/backend.env` (copy มาจาก `E:\\Project\\Order-Project-Backend\\.env.example` แล้วแก้ให้ถูกต้อง)
3. สร้าง `~/frontend.env` (ดูตัวอย่างใน repo frontend)
4. สร้างโฟลเดอร์ logs: `mkdir -p ~/logs/backend`

หมายเหตุ:
- ถ้าเครื่อง EC2 ของคุณใช้ `docker-compose` ให้เปลี่ยนคำสั่ง `docker compose` เป็น `docker-compose`

---

## 1) เข้าเครื่อง EC2
รันจากเครื่อง local:

```bash
ssh -i "e:/Project/pos.pem" ec2-user@54.255.216.29
```

ข้อควรระวัง:
- พิมพ์ command ทีละบรรทัดจริง ๆ
- อย่า copy output/prompt (`[ec2-user@...]$`) กลับไปรัน เพราะจะทำให้เกิด `command not found`

---

## 2) Deploy Backend (ทำก่อน)

### 2.1 ทำบนเครื่อง local: build + push backend image
```bash
cd /e/Project/Order-Project-Backend

# login ghcr (PAT ที่มี write:packages)
docker login ghcr.io -u ntpten-x

# build + push backend image
docker build -t ghcr.io/ntpten-x/order-project-backend:latest .
docker push ghcr.io/ntpten-x/order-project-backend:latest
```

### 2.2 ทำบน EC2: pull + restart เฉพาะ backend (compose)
```bash
# login ghcr (PAT ที่มี read:packages)
docker login ghcr.io -u ntpten-x

# pull backend ใหม่
docker compose -f ~/docker-compose.prod.yml pull backend

# restart เฉพาะ backend จาก compose
docker compose -f ~/docker-compose.prod.yml up -d backend
```

ถ้าเปลี่ยนค่า env (`~/backend.env`) ให้ใช้:
```bash
# force recreate เพื่อให้ container โหลด env ใหม่
docker compose -f ~/docker-compose.prod.yml up -d --force-recreate backend
```

### 2.3 เช็กสถานะ backend
```bash
docker ps
docker logs pos-backend --tail=200
curl -i http://127.0.0.1:3000/health
curl -i http://54.255.216.29:3000/health
```

คาดหวัง:
- `docker ps` ต้องเห็น `Up`
- `/health` ต้องได้ `HTTP/1.1 200 OK`

---

## 3) Retention Cron (ตรวจ/ตั้งครั้งเดียว แล้วใช้ยาว)

### 3.1 ติดตั้ง cron job
```bash
mkdir -p ~/logs/backend
(crontab -l 2>/dev/null | grep -v "maintenance:cleanup-orders"; \
echo "0 3 * * * docker exec pos-backend npm run maintenance:cleanup-orders >> $HOME/logs/backend/retention-cron.log 2>&1") | crontab -
crontab -l
```

### 3.2 ทดสอบ retention ทันที 1 รอบ
```bash
docker exec pos-backend npm run maintenance:cleanup-orders
tail -n 50 ~/logs/backend/retention-cron.log
```

---

## 4) Deploy Frontend แบบ Pull (หลัง Backend ผ่านแล้ว)
ดูขั้นตอนละเอียดในไฟล์:
- `../Order-Project-Frontend/DEPLOY_UPDATE_GUIDE.md`

---

## 5) Post-Deploy Checklist
1. เปิด `http://54.255.216.29:3001`
2. ลบ cookie ของโดเมน `54.255.216.29` แล้ว login ใหม่
3. ทดสอบ flow สำคัญ:
   - login/logout
   - switch branch
   - create/update/delete (POST/PUT/DELETE)
   - หน้า Audit และหน้า POS
4. ตรวจ `Health-System` ว่าไม่มี warning สำคัญ

---

## 6) Rollback แบบเร็ว (Backend)
ถ้าต้อง rollback แนะนำให้ push image เป็น tag แบบมีเวอร์ชัน (เช่น `:20260218-backend` หรือ `:sha-xxxx`) แล้วแก้ `image:` ใน `~/docker-compose.prod.yml` ชั่วคราว จากนั้น:

```bash
docker compose -f ~/docker-compose.prod.yml pull backend
docker compose -f ~/docker-compose.prod.yml up -d backend
```
