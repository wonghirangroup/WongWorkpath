# Wong Workpath

เครื่องมือภายในบริษัทสำหรับจัดการโปรเจกต์ งาน นัดประชุม เอกสาร คลังรหัสผ่าน และพนักงาน
(React + TypeScript + Vite ฝั่งหน้าเว็บ / Express + MySQL ฝั่งเซิร์ฟเวอร์)

รายละเอียดสถาปัตยกรรม สิทธิ์การใช้งาน และแนวทางการทำงานอยู่ใน [CLAUDE.md](CLAUDE.md)
ส่วนแนวทางการออกแบบหน้าจออยู่ใน [Design.md](Design.md)

## รันบนเครื่อง

ต้องมี Node.js และไฟล์ `.env` (ดูตัวอย่างที่ [.env.example](.env.example))

```
npm install
npm run dev:all      # เปิดทั้งหน้าเว็บ (พอร์ต 3000) และ API (พอร์ต 4000)
npm run lint         # ตรวจชนิดข้อมูลด้วย tsc
npm run build        # บิลด์หน้าเว็บ
```

> ⚠️ เครื่องพัฒนาเชื่อมฐานข้อมูล MySQL ตัวเดียวกับระบบจริง — ข้อมูลที่สร้าง/ลบตอนทดสอบกระทบข้อมูลจริง

## ระบบจริง

- หน้าเว็บ: Vercel (`wong-workpath.vercel.app`) — build ด้วย `npm run build`
- API: Render (`wongworkpath.onrender.com`) — รันด้วย `npm run server:start`
- push ขึ้น branch `main` = deploy จริงอัตโนมัติทั้งสองฝั่ง
- ตั้งค่า `JWT_SECRET` (สตริงสุ่มยาว 32 ตัวอักษรขึ้นไป) ใน Environment ของ Render — ใช้เซ็น token ล็อกอิน
