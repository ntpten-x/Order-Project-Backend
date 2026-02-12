# คู่มือการรันด้วย Docker (Backend)

## 0. คำสั่งรันแบบด่วน (สำหรับเริ่มงานปกติ)
```bash
docker-compose up -d
```

---

## 1. การอัปเดตและรันใหม่ (เมื่อแก้ไขโค้ดเสร็จ)
รันคำสั่งนี้ที่ Root ของโฟลเดอร์ `Order-Project-Backend`:

```bash
docker-compose up -d --build
```
*   `--build`: จะสั่งให้ Docker ทำการ Build Image ใหม่จากโค้ดที่คุณเพิ่งแก้ไข
*   `-d`: รันแบบ Background (Detached mode)

---

## 2. วิธีแยกขั้นตอน (กรณีต้องการตรวจสอบความถูกต้อง)

### ขั้นตอนที่ 1: Build Image ใหม่
```bash
docker-compose build
```

### ขั้นตอนที่ 2: เริ่มการทำงานใหม่
```bash
docker-compose up -d
```

---

## 3. คำสั่งที่จำเป็นอื่นๆ

### ตรวจสอบสถานะการทำงาน
```bash
docker-compose ps
```

### ดู Log การทำงาน (เพื่อเช็ค Error)
```bash
docker-compose logs -f api
```

### การจัดการฐานข้อมูล (กรณีมีการเพิ่มฟิลด์ใหม่)
หากมีการแก้ไข Entity (ตาราง) ผมตั้งค่า `TYPEORM_SYNC=true` ไว้ให้แล้ว ระบบจะอัปเดตตารางให้โดยอัตโนมัติเมื่อ Restart ครับ

### หยุดการทำงานทั้งหมด
```bash
docker-compose down
```
