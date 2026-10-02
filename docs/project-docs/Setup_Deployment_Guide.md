# Setup & Deployment Guide

## ⚠️ Backend บน VPS (`workpath-api.wonghiran.com`) — ตั้งแต่ 2569-09-30

frontend ที่ `workpath.wonghiran.com` เรียก backend ที่ **`https://workpath-api.wonghiran.com`** ซึ่งรันบน VPS ของบริษัท ไม่ใช่ Render (ยืนยันจาก request จริงในเบราว์เซอร์ 2569-10-02)

```
พนักงาน → workpath.wonghiran.com (Vercel, frontend)
              ↓ เรียก API
          workpath-api.wonghiran.com → VPS 178.128.119.174
              nginx (/etc/nginx/sites-available/workpath-api.conf, SSL Certbot)
              ↓ proxy_pass 127.0.0.1:3003
          Docker container `workpath-backend` (/opt/workpath-backend, node:20-alpine, `npx tsx server/index.ts`)
              ↓ ต่อฐานข้อมูล
          MySQL (ตัวเดียวกับที่เครื่องพัฒนาต่ออยู่)
```

- **Auto-deploy ด้วย GitHub Actions (2569-10-02)** — `.github/workflows/deploy-vps-backend.yml` ทำงานเมื่อ push ขึ้น `main` แล้วมีไฟล์ใน `server/**`, `src/data/**`, `package*.json`, `tsconfig.json` เปลี่ยน (แก้แค่ frontend จะไม่ deploy backend) → `npm run lint` ต้องผ่านก่อน → ส่งโค้ดจาก commit นั้นผ่าน SSH ไปให้ `/usr/local/bin/workpath-deploy` บน VPS · กด "Run workflow" ในแท็บ Actions เพื่อ deploy ซ้ำเองได้ · ดูผลได้ที่แท็บ Actions ของ repo
- **สคริปต์ฝั่ง VPS `/usr/local/bin/workpath-deploy`** (ต้นฉบับใน repo: `scripts/vps/workpath-deploy.sh` — **แก้ไฟล์นี้แล้วต้อง copy ขึ้น VPS เอง** Actions ไม่ได้อัปเดตตัวมันเอง) รับแค่ `status` กับ `deploy <sha>`: ตรวจไฟล์ที่ส่งมาให้ครบก่อนแตะอะไร → backup เป็น `/opt/workpath-backend.bak-<เวลา>` (เก็บ 5 ชุดล่าสุด) → แทนที่ `server/`, `src/data/`, `package*.json`, `tsconfig.json` → `docker compose up -d --build` → เช็ค health → **ถ้า build/health พัง ย้อนกลับเป็น backup เองอัตโนมัติ** → จด commit ไว้ที่ `/opt/workpath-backend/DEPLOYED_COMMIT` · มี lock กัน deploy ซ้อนกัน
- **SSH key ของ GitHub Actions** อยู่ใน secret `VPS_DEPLOY_KEY` ของ repo ใน `/root/.ssh/authorized_keys` key นี้ถูกล็อกด้วย `command="/usr/local/bin/workpath-deploy",no-pty,...` (comment `github-actions-wongworkpath-deploy`) — **รันได้แค่สคริปต์ deploy ไม่ได้ shell** ถ้า key หลุดให้ลบบรรทัดนั้นออกแล้วสร้างใหม่
- **Deploy มือ (สำรอง):** `npm run deploy:vps` (`scripts/deploy-vps-backend.sh`) ใช้สคริปต์ฝั่ง VPS ตัวเดียวกัน ต้องมี SSH root เข้า `178.128.119.174` (ตั้ง host ผ่าน env `VPS_HOST`, ค่าเริ่มต้นคือ alias `Smart-Jigsaw` ใน `~/.ssh/config`) · เช็คว่าตอนนี้ deploy commit ไหนอยู่: `ssh <host> /usr/local/bin/workpath-deploy status`
- ⚠️ SSH เข้า VPS ถี่ๆ ในเวลาสั้น (เช่น ~6 ครั้งใน 30 วิ) จะถูกบล็อก IP ชั่วคราว (เจอจริง 2569-10-02) — เว็บยังใช้ได้ปกติ แค่ SSH เข้าไม่ได้สักพัก อย่าวนลองถี่ๆ เพราะจะยิ่งโดนนาน
- `.env`, `Dockerfile`, `docker-compose.yml` บน VPS **ไม่ถูกแตะ** ทั้งแบบ auto และมือ — `JWT_SECRET` จึงคงเดิม คนที่ล็อกอินอยู่ไม่หลุด
- **ไม่รัน migration ทั้งแบบ auto และมือ** — ⚠️ เพราะ push = deploy ทันที ต้อง apply schema ใหม่กับฐานข้อมูลจริง**ก่อน push** โค้ดที่ใช้ schema นั้นเสมอ (ดูหัวข้อ "ขั้นตอน deploy ที่มีการเปลี่ยนฐานข้อมูล")
- ย้อนกลับเวอร์ชันเอง: `rm -rf /opt/workpath-backend && cp -a /opt/workpath-backend.bak-<เวลา> /opt/workpath-backend && cd /opt/workpath-backend && docker compose up -d --build`
- ⚠️ VPS เครื่องนี้มี container ของโปรเจกต์อื่นรันอยู่ด้วยอีกหลายตัว — อย่าใช้คำสั่งกว้างๆ อย่าง `docker compose down` นอกโฟลเดอร์ `/opt/workpath-backend` หรือ `docker system prune`
- 401 ไม่ได้แปลว่ามี route อยู่จริง: `requireAuth` ครอบทุก path ใต้ `/api` (ยกเว้น health/auth) จึงตอบ 401 ก่อนจะถึงขั้นหา route — เช็คว่า route มีจริงด้วยการ grep ในโค้ดของ container (`docker exec workpath-backend grep ...`) หรือเรียกพร้อม token

หัวข้อด้านล่างเรื่อง Render เขียนไว้ก่อนย้ายมา VPS — ยังไม่ได้ยืนยันว่า service บน Render ยังรันอยู่หรือถูกเลิกใช้แล้ว

## สถาปัตยกรรมการ deploy จริง (Render — ก่อนย้ายไป VPS)

```
พนักงาน → workpath.wonghiran.com (Vercel, frontend, โดเมนบริษัทเอง)
              ↓ เรียก API
          wongworkpath-jxiy.onrender.com (Render, backend, แพลนฟรี)
              ↓ ต่อฐานข้อมูล
          MySQL (ตัวเดียวกับที่เครื่องพัฒนาทุกเครื่องต่ออยู่)
```

⚠️ `wongworkpath-jxiy.onrender.com` (2569-09-30) เป็น service Render **ตัวใหม่** แยกจากตัวเดิม (`wongworkpath.onrender.com` ถูกระงับเพราะใช้โควต้าฟรีของ Render หมด "Free usage limit reached") service ใหม่ไม่มี environment variable ติดมาด้วยเลย ต้องตั้งใหม่ทั้งหมดตามหัวข้อด้านล่าง ก่อนจะใช้งานได้จริง

- **Frontend (Vercel):** build ด้วย `npm run build` (Vite) แล้ว serve ไฟล์ static
- **Backend (Render):** รันด้วย `npm run server:start` (`tsx server/index.ts` แบบไม่มี watch)
- **ฐานข้อมูล:** MySQL หนึ่งตัว ใช้ร่วมกันทั้ง Render และเครื่องพัฒนาทุกเครื่อง — **ไม่มีฐานข้อมูลแยกสำหรับทดสอบ**

ทั้งสอง service นี้แยกอิสระจากเครื่องพัฒนาโดยสิ้นเชิง (คนละ process/คนละโฮสต์) การปิด/เปิดเครื่องพัฒนาหรือ dev server บนเครื่องพัฒนาไม่กระทบบริการจริงที่พนักงานใช้อยู่เลย

## ⚠️ Auto-deploy จาก GitHub

Vercel และ Render ตั้ง auto-deploy จาก push ขึ้น branch `main` ไว้แล้วทั้งคู่ **ไม่ต้องมีใครไป deploy มือที่ dashboard** แต่นั่นหมายความว่า **การ push ขึ้น `main` คือการขึ้นระบบจริงทันที** ต้องระวังเป็นพิเศษก่อน push โดยเฉพาะเมื่อมีการเปลี่ยนแปลง schema/migration ที่ผูกกับโค้ดเวอร์ชันใหม่

**แนวทางที่ปลอดภัย:**
1. เลือก push ตอนที่คนใช้งานน้อย (เช่น นอกเวลาทำงาน)
2. ถ้ามีการเปลี่ยนฐานข้อมูล (เพิ่มตาราง/คอลัมน์) ให้ apply การเปลี่ยนแปลงกับฐานข้อมูลจริงด้วยสคริปต์ `tsx` แบบใช้ครั้งเดียวก่อน แล้วค่อย push โค้ดที่ใช้มัน — อย่าพึ่ง `server:migrate` กับข้อมูลที่มีอยู่แล้ว
3. หลัง push ให้รอจน Render deploy เสร็จ (เช็คผ่าน `https://wongworkpath-jxiy.onrender.com/api/health`) แล้วค่อยแจ้งผู้ใช้ให้รีเฟรชหน้าเว็บ 1 ครั้ง — ถ้า frontend เวอร์ชันใหม่ขึ้นก่อน backend เวอร์ชันเก่ายังไม่ทัน จะเรียก API ที่ไม่มีจริงชั่วคราว จนกว่า Render จะ deploy เสร็จ

## ตัวแปรแวดล้อมที่ต้องตั้งบน Render (production)

ต้องตั้งค่าเดียวกับหัวข้อ [Development_Environment.md](./Development_Environment.md) แต่ชี้ไปฐานข้อมูลและโดเมนจริง โดยเฉพาะ:

- **`DB_HOST` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` / `DB_PORT`** — ต้องชี้ไป MySQL ตัวเดียวกับที่เครื่องพัฒนาทุกเครื่องใช้อยู่ (ห้ามสร้างฐานข้อมูลใหม่แยกต่างหาก ไม่งั้นข้อมูลพนักงาน/โครงการจะไม่ตรงกับของจริง)
- **`JWT_SECRET`** — ควรตั้งเป็นค่าสุ่มยาวเองบน Render โดยเฉพาะ (ไม่ใช้ค่า fallback ที่ระบบสร้างเองจาก DB credentials) การเปลี่ยนค่านี้ทีหลังจะทำให้ทุกคนถูกล็อกเอาต์ทันที ควรเปลี่ยนตอนคนใช้น้อยและแยกจากการ push โค้ดฟีเจอร์อื่น — **ถ้าย้ายไป service ใหม่ ต้องตั้งค่าเดียวกับตัวเก่าไว้เป๊ะ** ไม่งั้นทุก token เดิมจะใช้ไม่ได้ทันที
- **`CORS_ORIGIN`** — ต้องเป็นโดเมน frontend จริงที่ใช้งานอยู่ (`https://workpath.wonghiran.com`) ไม่ใช่ `localhost` — ถ้ามีหลายโดเมน (เช่น ยังเก็บ `wong-workpath.vercel.app` ไว้ด้วย) คั่นด้วยคอมม่าไม่มีเว้นวรรค
- **`RESEND_API_KEY` / `RESEND_FROM_EMAIL`** — ต้องตั้งเพื่อให้ฟีเจอร์ลืมรหัสผ่านส่งอีเมลจริงได้ ต้อง verify domain กับ Resend ก่อน ไม่งั้นระบบจะ fallback เป็น sandbox sender ที่ส่งได้แค่หาอีเมลเจ้าของบัญชี Resend เอง

## ตัวแปรแวดล้อมที่ต้องตั้งบน Vercel (production)

- **`VITE_API_BASE_URL`** — ต้องชี้ไป `https://wongworkpath-jxiy.onrender.com`

## ข้อจำกัดของแพลนฟรี Render

- **"หลับ" เองถ้าไม่มีคนใช้งานนาน** — ตื่นครั้งแรกใช้เวลาประมาณ 30-60 วินาที (หน้าเว็บจะโหลดช้า/error รอบแรก) ไม่เกี่ยวกับโค้ดหรือเครื่องพัฒนา
- **⚠️ โควต้าใช้งานรายเดือนมีจำกัด (2569-09-30 เจอจริง)** — ถ้าใช้เกินโควต้าฟรีรายเดือน Render จะขึ้น "Free usage limit reached" แล้ว**ระงับ service ทันทีจนกว่าจะถึงรอบบิลลิ่งใหม่ หรืออัปเกรดแพลน** — ต่างจากอาการ "หลับ" ตรงที่**ตื่นเองไม่ได้** ต้องมีคนเข้าไปอัปเกรดแพลนหรือรอรอบบิลลิ่งใหม่เท่านั้น ถ้าเจออาการล็อกอินไม่ได้พร้อม error CORS ที่ดูปกติดี ให้เช็คหน้า Render dashboard ก่อนว่ามีแถบ "suspended" ขึ้นอยู่ไหม

## ขั้นตอน deploy ที่มีการเปลี่ยนฐานข้อมูล

1. เขียนสคริปต์ `tsx` ที่ import `server/db.ts` แล้วรัน SQL ที่ต้องการ (CREATE TABLE / ALTER TABLE เป็นต้น) ตรวจผลด้วย `DESCRIBE`/`SELECT` แล้วลบสคริปต์ทิ้ง
2. เขียนโค้ดฝั่งเซิร์ฟเวอร์/ไคลเอ็นต์ให้ใช้ schema ใหม่
3. ตรวจ `npm run lint` ผ่าน และทดสอบบนเครื่องพัฒนา (ซึ่งต่อฐานข้อมูลเดียวกับที่แก้ไปแล้วในข้อ 1 อยู่แล้ว) ให้แน่ใจว่าใช้งานได้จริง
4. commit และ push ขึ้น `main` ตอนคนใช้น้อย
5. รอ GitHub Actions ("Deploy backend to VPS") deploy backend เสร็จ ดูผลที่แท็บ Actions (Vercel deploy frontend เองอัตโนมัติ)
6. ตรวจ `https://workpath-api.wonghiran.com/api/health` แล้วรีเฟรชหน้าเว็บทดสอบจริง

## ห้ามทำ

- อย่ารันคำสั่งฆ่า process แบบกว้างๆ เช่น `taskkill //F //IM node.exe //T` บนเครื่องพัฒนาโดยไม่จำเป็น อาจฆ่างานอื่นที่กำลังทดสอบอยู่
- อย่ารัน `npm run server:migrate` กับฐานข้อมูลที่มีข้อมูลอยู่แล้วโดยไม่ตรวจสอบก่อน (ไม่มี ledger กันรันซ้ำ)
- อย่าสร้าง/ทดสอบข้อมูลบนเครื่องพัฒนาโดยไม่ใช้ prefix `E2E_`/`e2e_` — ข้อมูลทุกอย่างที่สร้างจริงคือข้อมูลจริงในระบบ production ด้วย
