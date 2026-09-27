# Development Environment

## ⚠️ ข้อควรระวังก่อนเริ่ม

**เครื่องพัฒนาทุกเครื่องต่อฐานข้อมูล MySQL จริงตัวเดียวกับระบบ production** (Render) การรัน `npm run dev`, ทดสอบ, หรือรัน migration บนเครื่องพัฒนา **มีผลกระทบต่อข้อมูลจริง** เสมอ ไม่ใช่ sandbox แยกต่างหาก

- การเปิด/ปิด dev server บนเครื่องพัฒนา **ไม่กระทบ** ระบบจริงที่พนักงานใช้อยู่ (คนละ process กัน)
- แต่การ **สร้าง/แก้/ลบข้อมูล** ผ่านเครื่องพัฒนา **กระทบข้อมูลจริงทันที** เพราะเป็นฐานข้อมูลเดียวกัน
- ถ้าต้องทดสอบ ให้ใช้บัญชี/ข้อมูลที่ขึ้นต้นด้วย `E2E_`/`e2e_` แล้วลบทิ้งหลังทดสอบเสมอ

## เครื่องมือที่ต้องมี

- Node.js (แนะนำเวอร์ชัน LTS ล่าสุด — ไม่ได้ระบุ `engines` ตายตัวใน `package.json`)
- MySQL server ที่เข้าถึงได้ (หรือใช้ connection ไปยังฐานข้อมูลจริงตามที่ทีมกำหนด)
- npm (มากับ Node.js)

## ติดตั้งครั้งแรก

```bash
git clone <repo>
cd WongWorkpath
npm install
cp .env.example .env   # แล้วกรอกค่าจริงตามหัวข้อถัดไป
```

## ตัวแปรแวดล้อม (.env)

| ตัวแปร | ใช้ที่ไหน | คำอธิบาย |
|---|---|---|
| `DB_HOST` | server/db.ts | ที่อยู่ฐานข้อมูล MySQL |
| `DB_USER` | server/db.ts | ผู้ใช้ฐานข้อมูล |
| `DB_PASSWORD` | server/db.ts | รหัสผ่านฐานข้อมูล |
| `DB_NAME` | server/db.ts | ชื่อฐานข้อมูล |
| `DB_PORT` | server/db.ts | พอร์ต (ปกติ 3306) |
| `PORT` | server/index.ts | พอร์ตที่ backend รัน (dev = 4000) |
| `CORS_ORIGIN` | server/index.ts | origin ที่อนุญาตให้เรียก API (dev = `http://localhost:3000`) |
| `JWT_SECRET` | server/lib/auth.ts | กุญแจเซ็น session token (32+ ตัวอักษรสุ่ม) — ถ้าไม่ตั้ง ระบบจะสร้างจาก DB credentials เองพร้อม log คำเตือน |
| `RESEND_API_KEY` | server/routes/auth.ts | สำหรับส่งอีเมล OTP ลืมรหัสผ่านจริง |
| `RESEND_FROM_EMAIL` | server/routes/auth.ts | อีเมลผู้ส่ง (ต้อง verify domain กับ Resend ก่อน ไม่งั้น fallback เป็น sandbox sender ที่ส่งได้แค่หาอีเมลเจ้าของบัญชี Resend) |
| `VITE_API_BASE_URL` | src/lib/api.ts | URL ของ backend ที่ frontend จะเรียก (dev = `http://localhost:4000`) |

ตัวอย่างเต็มอยู่ใน `.env.example` ที่ root ของ repo

## คำสั่งที่ใช้บ่อย

```bash
npm run dev                        # เปิด Vite dev server พอร์ต 3000 — สำหรับพัฒนา/ทดสอบบนเครื่องนี้เท่านั้น
npm run server:dev                 # เปิด Express API server พอร์ต 4000 พร้อม hot-reload
npm run dev:all                    # รันทั้งสองอย่างพร้อมกัน (ใช้บ่อยที่สุด)
npm run server:start               # รัน API server แบบ production (ไม่มี watch) — คำสั่งเดียวกับที่ Render ใช้
npm run build                      # build frontend ด้วย Vite — คำสั่งเดียวกับที่ Vercel ใช้
npm run preview                    # พรีวิวเวอร์ชัน build แล้ว
npm run lint                       # tsc --noEmit — การตรวจสอบอัตโนมัติหลักของโปรเจกต์
npm run clean                      # ลบ dist/ และ server.js
npm run server:migrate             # รัน migration SQL ทั้งหมดใน server/sql/*.sql ตามลำดับ (ไม่มีระบบจดว่ารันไปแล้วหรือยัง — ดูคำเตือนด้านล่าง)
npm run server:seed                # seed ข้อมูลเริ่มต้น (โปรเจกต์/งาน)
npm run server:seed-employees      # seed ข้อมูลพนักงานเริ่มต้น
npm run server:seed-credentials    # seed ข้อมูลคลังรหัสผ่านเริ่มต้น
npm run server:seed-employee-logins # seed บัญชีล็อกอินของพนักงาน
```

## ⚠️ เรื่อง migration ที่ต้องระวังเป็นพิเศษ

`npm run server:migrate` รันไฟล์ทั้งหมดใน `server/sql/*.sql` ตามลำดับ **โดยไม่มีระบบจดจำว่าไฟล์ไหนรันไปแล้ว** (ไม่มี migration ledger) วิธีที่ทีมใช้จริงเมื่อจะเพิ่มตาราง/คอลัมน์ใหม่คือ **เขียนสคริปต์ `tsx` แบบใช้ครั้งเดียว** เชื่อมต่อผ่าน `server/db.ts` แล้วรันเอง ไม่ใช้คำสั่ง `server:migrate` ตรงๆ กับฐานข้อมูลที่มีข้อมูลอยู่แล้ว

## การทดสอบ (ไม่มี test runner อัตโนมัติในโปรเจกต์)

- ตรวจสอบ type ด้วย `npm run lint` (`tsc --noEmit`) หลังแก้โค้ดทุกครั้ง
- ทดสอบพฤติกรรมจริงในเบราว์เซอร์: ติดตั้ง `playwright` แบบชั่วคราว (`npm install --no-save playwright`) → เขียนสคริปต์ทดสอบแบบใช้ครั้งเดียว (throwaway) ที่ล็อกอินจริงและสร้าง/ลบข้อมูลทดสอบของตัวเอง → ถอนการติดตั้งออกหลังใช้เสร็จ (`npm uninstall playwright --no-save`)
- บัญชีทดสอบต้องขึ้นต้นด้วย `E2E_` (id พนักงาน) / `e2e_` (username) แทรกตรงเข้าตาราง `employee` + `login` แล้วลบทิ้งหลังทดสอบเสมอ ห้ามสร้างบัญชีทดสอบระดับ superadmin/executive ทิ้งไว้นานเกินจำเป็น (มีข้อจำกัดจำนวนจริง)
- ดู [Test_Cases.md](./Test_Cases.md) สำหรับชุดทดสอบหลักที่ใช้ตรวจสอบระบบ

## โครงสร้างโค้ดโดยสรุป

```
src/pages/*.tsx              route wrapper บางๆ เชื่อม useAppData() กับ component จริง
src/components/layout/       AppLayout, Header, Sidebar
src/components/*.tsx         component หลักของแต่ละแท็บ (Dashboard, CalendarView, DocVault, ...)
src/components/projectBoard/ โมดูล "จัดการงานและโครงการ" ทั้งหมด
src/context/AppDataContext.tsx   state ทั้งหมดของแอปฝั่ง client + เรียก API ทุกโดเมน
src/lib/api.ts                ฟังก์ชันเรียก API ทั้งหมด
src/lib/permissions.ts, ownership.ts   ตรรกะสิทธิ์ฝั่ง client
src/types.ts                  โมเดลข้อมูลกลาง
server/index.ts               Express app, mount routes ทั้งหมด
server/routes/*.ts            API endpoint แต่ละโดเมน
server/lib/                   helper ฝั่งเซิร์ฟเวอร์ (auth, ownership, access, datetime)
server/db.ts                  MySQL connection pool
server/sql/NNN_*.sql          migration แต่ละไฟล์
server/seed*.ts               สคริปต์ seed ข้อมูลเริ่มต้น
```
