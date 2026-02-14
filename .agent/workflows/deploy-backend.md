---
description: Backend production deployment on AWS EC2 (install + hardening + runbook)
---

# Deploy Backend to AWS (Production)

เอกสารนี้เป็นขั้นตอน deploy `Order-Project-Backend` ขึ้น AWS แบบใช้งานจริง โดยเริ่มจาก backend ก่อน

## 0) สิ่งที่ต้องมี

- AWS EC2 (แนะนำ Amazon Linux 2023)
- Security Group พร้อมเปิดพอร์ต:
  - `22` (SSH) เฉพาะ IP ทีม
  - `80`, `443` จาก internet
- PostgreSQL production (แนะนำ RDS)
- Redis production (แนะนำ ElastiCache/Redis Cloud)
- Frontend URL: `http://13.239.29.168:3001`
- Backend URL: `http://13.239.29.168:3000`
- Key file: `e:/Project/pos-key.pem`

ข้อควรระวังสำคัญ:
- ตอน `NODE_ENV=production` ระบบ cookie auth ตั้ง `secure=true` และ `sameSite=none`
- ถ้าเรียกผ่าน `http://` cookie อาจไม่ถูกส่ง ทำให้ login/csrf มีปัญหา
- แนะนำใช้ domain + HTTPS จริงก่อน go-live ผู้ใช้จริง

หมายเหตุ:
- ถ้าจะ deploy แบบ `git pull` ไม่ต้อง upload `dist` จากเครื่อง local
- ให้ push โค้ดขึ้น remote ก่อน แล้วค่อย pull บน EC2

## 1) เชื่อมต่อ EC2

```bash
ssh -i "e:/Project/pos-key.pem" ec2-user@13.239.29.168
```

## 2) ติดตั้ง runtime และเครื่องมือบน EC2 (ครั้งแรกเท่านั้น)

```bash
sudo dnf update -y
sudo dnf install -y git nginx
sudo dnf install -y nodejs20 npm
sudo npm install -g pm2
```

ตรวจสอบเวอร์ชัน:

```bash
node -v
npm -v
pm2 -v
nginx -v
```

## 3) ดึงโค้ดและติดตั้ง dependencies

```bash
cd ~
git clone <YOUR_GIT_REPO_URL> Order-Project-Backend
cd ~/Order-Project-Backend
npm ci
```

ถ้าเคย clone แล้ว:

```bash
cd ~/Order-Project-Backend
git fetch --all
git checkout develop
git pull origin develop
npm ci
```

## 4) ตั้งค่า `.env` production (สำคัญ)

สร้างไฟล์ `~/Order-Project-Backend/.env`

```env
NODE_ENV=production
PORT=3000

DATABASE_HOST=<RDS_HOST>
DATABASE_PORT=5432
DATABASE_USER=<DB_USER>
DATABASE_PASSWORD=<DB_PASSWORD>
DATABASE_NAME=<DB_NAME>
DATABASE_SSL=true
DATABASE_SSL_REJECT_UNAUTHORIZED=false

JWT_SECRET=<STRONG_RANDOM_SECRET>
FRONTEND_URL=http://13.239.29.168:3001

TYPEORM_SYNC=false
RUN_MIGRATIONS_ON_START=false
REQUIRE_NO_PENDING_MIGRATIONS=true
ALLOW_BYPASSRLS=0

REDIS_URL=redis://<REDIS_HOST>:6379
REDIS_CACHE_ENABLED=true
RATE_LIMIT_REDIS_URL=redis://<REDIS_HOST>:6379
SOCKET_REDIS_ADAPTER_ENABLED=true

ORDER_RETENTION_ENABLED=true
ORDER_QUEUE_RETENTION_ENABLED=true
STOCK_ORDER_RETENTION_ENABLED=true
AUDIT_LOG_RETENTION_ENABLED=true
ORDER_RETENTION_DRY_RUN=false
```

## 5) Build + migrate + health check ก่อนเปิด service

```bash
cd ~/Order-Project-Backend
npm run env:check
npm run check:release
npm run migration:run
npm run build
```

ทดสอบสตาร์ตชั่วคราว:

```bash
npm run start
```

เปิดอีก terminal แล้วเช็ค:

```bash
curl http://127.0.0.1:3000/health
```

ถ้าผ่าน ให้หยุด process (`Ctrl + C`) แล้วไปขั้นตอนถัดไป

## 6) รันด้วย PM2 และตั้ง auto-start

```bash
cd ~/Order-Project-Backend
pm2 start ecosystem.config.js --name pos-backend
pm2 save
pm2 startup systemd -u ec2-user --hp /home/ec2-user
```

จากนั้น copy คำสั่ง `sudo ...` ที่ PM2 แสดงขึ้นมารันอีกรอบ (เพื่อ enable startup)

ตรวจสอบ:

```bash
pm2 status
pm2 logs pos-backend --lines 100
```

## 7) ตั้ง Nginx reverse proxy (รองรับ API + WebSocket)

สร้างไฟล์:

```bash
sudo tee /etc/nginx/conf.d/pos-backend.conf > /dev/null <<'EOF'
server {
    listen 80;
    server_name 13.239.29.168;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF
```

```bash
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl restart nginx
```

## 8) เปิด HTTPS (แนะนำ Let's Encrypt)

```bash
sudo dnf install -y certbot python3-certbot-nginx
# สำหรับ IP ตรงจะออกใบ cert ไม่ได้ (Let's Encrypt ต้องเป็น domain)
# ให้ใช้ได้เมื่อมี domain เช่น api.example.com แล้วค่อยรัน certbot
```

ตรวจสอบ auto renew:

```bash
sudo systemctl status certbot-renew.timer
sudo certbot renew --dry-run
```

## 9) ตั้ง retention job (ลบข้อมูลอัตโนมัติ)

ใช้ cron (Linux):

```bash
cd ~/Order-Project-Backend
npm run maintenance:install-cron
```

ทดสอบรันมือ:

```bash
npm run maintenance:cleanup-orders
tail -n 20 logs/retention-jobs.log
```

## 10) ขั้นตอน deploy รอบถัดไป (หลังมีโค้ดใหม่)

```bash
ssh -i "e:/Project/pos-key.pem" ec2-user@13.239.29.168
cd ~/Order-Project-Backend
git pull origin develop
npm ci
npm run check:release
npm run migration:run
npm run build
pm2 restart pos-backend --update-env
pm2 status
```

## 11) Post-deploy checklist (backend)

```bash
curl -i http://13.239.29.168:3000/health
pm2 logs pos-backend --lines 100
```

เช็คเพิ่มเติม:
- login จาก frontend ผ่านจริง
- socket realtime ใช้งานได้
- migration ไม่มีค้าง
- retention log มี `status: success`

## 12) ถ้าจะใช้ build จากเครื่อง local จริงๆ

วิธีนี้ทำได้ แต่ไม่แนะนำเท่า `git pull + build บน server` เพราะเสี่ยงไฟล์ไม่ครบ

```bash
scp -r -i "e:/Project/pos-key.pem" e:/Project/Order-Project-Backend/dist ec2-user@13.239.29.168:~/Order-Project-Backend/
```

จากนั้นยังต้องมี `package.json`, `node_modules`, `.env` บน server ให้ครบ และ restart PM2
