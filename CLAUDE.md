# CLAUDE.md

ไฟล์นี้ให้คำแนะนำสำหรับ Claude Code (claude.ai/code) เมื่อทำงานกับโค้ดในโปรเจกต์นี้

## แนวทางการทำงานร่วมกัน (Collaboration guidelines)

- คุยกับผู้ใช้เป็นภาษาไทยโดยภาษาที่เข้าใจง่ายๆ เหมือนคุยกับเพื่อน
- หากติดปัญหา ไม่แน่ใจ หรือไม่ชัดเจนว่าควรทำแบบไหน ให้ถามผู้ใช้ก่อนเสมอ อย่าเดาเอาเอง
- อธิบายให้ผู้ใช้เข้าใจ
- ให้อธิบายเวลาเริ่มทำงานของวัน ต้องอัพเดตกับผู้ใช้ว่าทำอะไรอยู่
- เตือนผู้ใช้เสมอว่าตรงไหนผิด พร้อมทางแก้ไข

## ⚠️ มี production deployment จริงแยกต่างหากแล้ว (Vercel + Render) — แต่เครื่องนี้ก็ยังชี้ไปฐานข้อมูลจริงเหมือนกัน

**พนักงานใช้งานจริงทุกวันผ่าน `wong-workpath.vercel.app` (frontend, Vercel) ซึ่งเรียก backend ที่ `wongworkpath.onrender.com` (Render, รันด้วย `npm run server:start`)** สอง service นี้แยกอิสระจากเครื่องพัฒนาเครื่องนี้โดยสิ้นเชิง (ยืนยันแล้วว่าเป็นคนละ process/คนละโฮสต์ ตั้งค่าไว้ตั้งแต่ 2569-08-25 โดยทีม ไม่ใช่ของ session นี้) **การปิด/เปิด session ของ Claude Code หรือการเปิด-ปิด `npm run dev` / `npm run server:dev` บนเครื่องนี้ ไม่กระทบบริการจริงที่พนักงานใช้อยู่เลย**

- **แต่ Render กับเครื่องนี้ต่อ MySQL ตัวเดียวกัน (ฐานข้อมูลจริงเดียวกัน, ยืนยันแล้วว่าข้อมูลพนักงานตรงกันเป๊ะ)** — ดังนั้นการทดสอบ/รัน migration/สร้างลบข้อมูลบนเครื่องนี้ยังกระทบข้อมูลจริงเหมือนเดิมทุกประการ ต้องระวังเรื่องข้อมูลทดสอบเหมือนเดิม
- **Render เป็นแพลนฟรี (ยืนยันแล้ว)** จะ "หลับ" เองถ้าไม่มีคนใช้นานๆ แล้วต้องใช้เวลาสัก 30-60 วินาทีตอนตื่นครั้งแรกหลังจากนั้น (หน้าเว็บจะโหลดช้า/error รอบแรก) ไม่เกี่ยวกับเครื่องนี้หรือ session ของ Claude Code — เป็นข้อจำกัดของแพลนฟรี ถ้าอยากแก้ต้องอัปเกรดแพลน Render
- **Vercel และ Render ตั้ง auto-deploy จาก GitHub push ไว้แล้ว (ยืนยันแล้ว)** — โค้ดที่ push ขึ้น branch `main` จะขึ้นจริงให้พนักงานเห็นเองอัตโนมัติ ไม่ต้องมีใครไป deploy มือที่ dashboard แต่ก็หมายความว่า **การ push ขึ้น `main` คือการขึ้นระบบจริงทันที** ควรระวังเรื่องนี้เป็นพิเศษก่อน push (โดยเฉพาะ schema/migration ที่ผูกกับโค้ดเวอร์ชันใหม่)
- ถึงจะไม่กระทบบริการจริงแล้ว **ก็ยังไม่ควรรันคำสั่งฆ่า process แบบกว้างๆ เช่น `taskkill //F //IM node.exe //T`** บนเครื่องนี้โดยไม่จำเป็น เพราะอาจฆ่างานอื่นที่กำลังทดสอบอยู่ — ถ้าจำเป็นต้องเริ่ม server ที่ยังไม่ได้รัน ให้สั่งรันเพิ่มเท่านั้น

## คำสั่ง (Commands)

```
npm run dev                        # เปิด Vite dev server ที่พอร์ต 3000 (host 0.0.0.0) — สำหรับพัฒนา/ทดสอบบนเครื่องนี้เท่านั้น ไม่ใช่สิ่งที่พนักงานใช้จริง
npm run server:dev                 # เปิด Express API server ที่พอร์ต 4000 พร้อม hot-reload (tsx watch) — สำหรับพัฒนา/ทดสอบบนเครื่องนี้เท่านั้น
npm run dev:all                    # รันทั้ง dev + server:dev พร้อมกันด้วย concurrently
npm run server:start               # รัน API server แบบ production (ไม่มี watch) — คำสั่งที่ Render ใช้รัน backend จริงบน wongworkpath.onrender.com
npm run build                      # บิลด์เวอร์ชันโปรดักชันด้วย Vite (ฝั่ง frontend เท่านั้น) — สิ่งที่ Vercel ใช้ build wong-workpath.vercel.app
npm run preview                    # พรีวิวเวอร์ชันโปรดักชันที่บิลด์แล้ว
npm run lint                       # tsc --noEmit (เช็คชนิดข้อมูลอย่างเดียว ไม่มี linter แยกต่างหาก)
npm run clean                      # rm -rf dist server.js
npm run server:migrate             # รัน migration SQL ทั้งหมดใน server/sql/*.sql ตามลำดับ
npm run server:seed                # seed ข้อมูลเริ่มต้น (โปรเจกต์/งาน ฯลฯ)
npm run server:seed-employees      # seed ข้อมูลพนักงานเริ่มต้น
npm run server:seed-credentials    # seed ข้อมูลคลังรหัสผ่านเริ่มต้น
npm run server:seed-employee-logins # seed บัญชีล็อกอินของพนักงาน (username/password hash)
```

โปรเจกต์นี้ไม่มีการตั้งค่า test runner (ไม่มีชุดทดสอบ Jest/Vitest/Playwright ไม่มีสคริปต์ `test`) ให้ใช้ `npm run lint` (`tsc --noEmit`) เป็นการตรวจสอบความถูกต้องอัตโนมัติหลักหลังจากแก้ไขโค้ด สำหรับการตรวจสอบพฤติกรรมจริงในเบราว์เซอร์ แนวทางที่ใช้ประจำคือติดตั้ง `playwright` แบบชั่วคราว (`npm install --no-save playwright`) เขียนสคริปต์ทดสอบแบบ throwaway ที่ล็อกอินจริงและสร้าง/ลบข้อมูลทดสอบของตัวเอง แล้วถอนการติดตั้งออกหลังใช้เสร็จ **หลังมีระบบ token แล้ว API ยิงตรงไม่ได้ถ้าไม่ล็อกอิน** — สคริปต์ทดสอบต้องมีบัญชีทดสอบ (สร้างด้วยสคริปต์ `tsx` ที่ insert ตรงลง `employee`+`login` ด้วย id/username ขึ้นต้น `E2E_`/`e2e_` แล้วลบทิ้งหลังทดสอบ — อย่าสร้างบัญชี superadmin/executive ทดสอบเผื่อไว้นานเกินจำเป็น)

## สถาปัตยกรรม (Architecture)

นี่คือแอป **React 19 + TypeScript + Vite + Tailwind CSS v4** ฝั่ง frontend คู่กับ **Express + MySQL** ฝั่ง backend ("Wong Workpath" — ยังคงมีการอ้างอิงชื่อเดิม "UnitySpace" หลงเหลืออยู่ใน localStorage key prefix `unityspace_*` และข้อความ audit-log) เป็นเครื่องมือภายในบริษัทสำหรับจัดการโปรเจกต์/งาน/นัดประชุม/เอกสาร/รหัสผ่าน/พนักงาน ใช้งานจริงทุกวันโดยพนักงานจริง (ไม่ใช่ mock/demo) Tailwind v4 เชื่อมต่อผ่าน `@tailwindcss/vite` โดยไม่มีไฟล์ `tailwind.config.*` — theme tokens อยู่ใน `src/index.css` ภายใต้ `@theme`

**Backend เป็นของจริง ไม่ใช่ localStorage-only แล้ว** — `server/index.ts` เป็น Express app เชื่อมต่อ MySQL จริงผ่าน `server/db.ts` (`mysql2`) ตาราง/route หลักที่มีอยู่ใน `server/routes/`: `auth.ts` (ล็อกอินจริงด้วย bcrypt + ระบบลืมรหัสผ่าน/OTP ผ่าน `resend`), `employees.ts`, `projects.ts`, `project-tasks.ts`, `project-custom-statuses.ts`, `documents.ts`, `credentials.ts`, `meetings.ts`, `notifications.ts`, `change-requests.ts`, `org-structure.ts` (โครงสร้างองค์กร ฝ่าย/แผนก), `audit-logs.ts` (บันทึกกิจกรรม) แต่ละ route มี authorization check ของตัวเอง (ดูหัวข้อ Role & Permission ด้านล่าง) ไม่ใช่ trust client เหมือนเวอร์ชันแรกๆ ของโปรเจกต์ Migration อยู่ที่ `server/sql/NNN_description.sql` รันผ่าน `npm run server:migrate`; ข้อมูลเริ่มต้นอยู่ใน `server/seed*.ts`

**ระบบยืนยันตัวตนเป็นของจริง ไม่ใช่ mock login แล้ว** — `src/components/Login.tsx` เรียก `POST /api/auth/login` ซึ่งเช็ครหัสผ่านจริงด้วย `bcrypt.compare` กับ `login.password_hash` ในฐานข้อมูล (ไม่ใช่ "รหัสผ่านอะไรก็ผ่านหมด" เหมือนเวอร์ชันแรกของโปรเจกต์อีกต่อไป) flow ลืมรหัสผ่าน/OTP ก็ต่อกับ backend จริงผ่าน `server/routes/auth.ts` + `resend` (ส่งอีเมลจริง ถ้ามี `RESEND_API_KEY`) 

**Session/token (2569-09-24)** — เดิมเซิร์ฟเวอร์ไม่มี session เลย ใครรู้ URL ก็ยิง API ได้และอ้างตัวตนผ่าน `actorEmployeeId` ที่ client ส่งมาเอง ตอนนี้แก้แล้ว:
- `POST /api/auth/login` คืน `{ token, employee }` — token เซ็นด้วย HMAC-SHA256 (`server/lib/auth.ts`, อายุ 30 วัน, secret จาก env `JWT_SECRET`; ถ้าไม่ตั้ง จะสร้างจาก DB credentials พร้อม log warning) เก็บใน `localStorage` (`unityspace_auth_token`) ส่งเป็น `Authorization: Bearer` (ไม่ใช้ cookie เพราะ Vercel กับ Render อยู่คนละโดเมน)
- ทุก route ใต้ `/api` ยกเว้น `/api/health` และ `/api/auth/{login,forgot-password,verify-otp,reset-password}` ต้องผ่าน `requireAuth` (mount ใน `server/index.ts`) ซึ่งตรวจ token + ว่าบัญชียังใช้ได้ (cache 30 วิ; ลบพนักงานแล้ว `forgetActor` ทันที) แล้ว **เขียนทับ** `actorEmployeeId` (query/body), `decidedBy`, `requestedBy` ด้วยตัวตนจริงจาก token — client ปลอมตัวตนไม่ได้ ใน route ให้ใช้ `req.actorId` เป็นหลัก
- `src/lib/api.ts` มี `authFetch` (แนบ token, เจอ 401 → ล้าง token แล้วเรียก handler ให้เด้งไปหน้า login พร้อมข้อความ "เซสชันหมดอายุ") — เรียก API ใหม่ต้องใช้ `authFetch` ไม่ใช่ `fetch` ตรงๆ
- restore session ตอนโหลดหน้าใหม่ = `GET /api/auth/me` (ไม่มี `unityspace_current_user_id` แล้ว); ข้อมูลทุกโดเมนโหลดหลังล็อกอินเท่านั้น (`useLoadOnLogin` ใน `AppDataContext`) และไม่ cache รายชื่อพนักงานใน localStorage แล้ว
- ล็อกอินผิดเกิน 5 ครั้ง/15 นาที (ต่อ IP+username; รวมต่อ IP 30 ครั้ง) → 429 (`server/lib/rateLimit.ts`, เก็บใน memory)
- ลืมรหัสผ่าน: OTP สร้างด้วย `crypto.randomInt`; `verify-otp` คืน `resetToken` (เซ็น, อายุ 10 นาที, ผูกกับอีเมล) และ `reset-password` ต้องแนบ token นี้
- ⚠️ frontend กับ backend ต้อง deploy คู่กัน: frontend ใหม่ + backend เก่า (หรือกลับกัน) จะล็อกอิน/เรียก API ไม่ได้ชั่วคราวระหว่าง deploy ควร push ตอนที่คนใช้น้อย และตั้ง `JWT_SECRET` ที่ Render ก่อน

**การทำ routing ใช้ `react-router-dom` v7** ติดตั้งผ่าน `<BrowserRouter>` ใน `src/main.tsx` ไฟล์ `src/App.tsx` กำหนด route ทั้งหมด: `/login` (เข้าถึงได้แบบสาธารณะ) และ `/dashboard`, `/tasks`, `/gantt`, `/calendar`, `/docs`, `/vault`, `/employees`, `/settings` ซึ่งอยู่หลัง `ProtectedLayoutRoute` ที่จะ redirect ไปหน้า `/login` เมื่อ `currentUser` เป็น null ทุก route (ยกเว้น `/dashboard` และ `/settings` ที่เปิดให้ทุกบัญชีเสมอและ admin จำกัดรายคนไม่ได้) ยังผ่าน `NavGuardRoute` ที่บล็อกการเข้าถึงตรงด้วย URL หากสิทธิ์ของบัญชีนั้นไม่อนุญาต (เช็คเดียวกับที่ Sidebar ใช้ซ่อนลิงก์) **หมายเหตุ**: `/gantt` ไม่ได้แสดง Gantt chart แบบเดิมแล้ว แต่ render `MyWorkspace` ("งานของฉัน" — มุมมองงาน/โครงการ/Timeline ของผู้ใช้คนนั้นเอง ข้ามหลายโครงการ) แต่ละ route จะ render page component แบบบางๆ ใน `src/pages/*.tsx` ที่ดึงข้อมูล/handler จาก `useAppData()` แล้วส่งเป็น props ไปยัง component ที่แสดงผลจริงใน `src/components/`

**state ฝั่ง client ทั้งหมดอยู่ใน `src/context/AppDataContext.tsx`** เข้าถึงผ่าน hook `useAppData()` (`AppDataProvider` ครอบ router ไว้ใน `App.tsx`) ไม่มี state library อื่นนอกจากนี้ **ทุกโดเมนดึงข้อมูลจริงจาก API ผ่าน `src/lib/api.ts`** (พนักงาน, โครงการ, งาน, เอกสาร, รหัสผ่าน, นัดประชุม, การแจ้งเตือน, คำขออนุมัติแก้ไข/ลบ, โครงสร้างองค์กร, บันทึกกิจกรรม) แล้วเก็บผลไว้ใน React state — ทุกการเปลี่ยนแปลงข้อมูลเรียก API จริง (`handleSaveTask`, `handleAddCredential`, `handleUpdateEmployee`, `handleLogAudit`, `handleAddDivision` ฯลฯ) ไม่ได้เขียนกลับ localStorage เป็นหลักแหล่งข้อมูลอีกต่อไป (2569-09-22: ย้าย โครงสร้างองค์กร และ บันทึกกิจกรรม ออกจาก localStorage-only ขึ้นเป็นตาราง `org_division`/`org_section`/`audit_log` จริงแล้ว ผ่าน `server/routes/org-structure.ts`/`audit-logs.ts` — สองโดเมนสุดท้ายที่เคยเป็น localStorage-only เป็นของจริงหมดแล้ว ระบบงานเก่าแบบ mock `unityspace_tasks`/`Task[]`/`HandoverRecord` ที่เคยค้างอยู่ก็ถูกลบทิ้งทั้งระบบ ไม่มีอยู่ในโค้ดแล้ว — ระบบงานจริงคือ `projectTasks`/`ProjectTaskItem[]` จาก `project_task` table เท่านั้น)

**การแจ้งเตือนกำหนดส่งงาน/โครงการ (2569-09-24)** — ไม่มี scheduler ฝั่งเซิร์ฟเวอร์ ตัวสแกนอยู่ใน `AppDataContext.tsx` (effect ที่ใช้ `pickReminderLead`) ทำงานบน client ของแต่ละคนตอนเปิดแอป/ข้อมูลเปลี่ยน (รอให้โหลดการแจ้งเตือนเดิมและตารางช่วงเตือนเสร็จก่อนถึงสแกน กันเตือนซ้ำ): **งาน** ที่ตัวเองเป็นผู้รับผิดชอบ + ยังไม่ done + มีวันกำหนด → เลยกำหนด = แจ้ง "เลยกำหนดส่ง" ครั้งเดียวต่องาน; ยังไม่เลย = แจ้ง "ใกล้ครบกำหนด" ตามช่วงที่ตั้งไว้ · **โครงการ** ที่ตัวเองเป็นผู้รับผิดชอบหลัก/ร่วม + สถานะไม่ใช่เสร็จสิ้น/ยกเลิก + มีวันสิ้นสุด → แจ้ง "โครงการใกล้สิ้นสุด" (ไม่มีแจ้งเลยกำหนดของโครงการ ตั้งใจไว้กันแจ้งรัวตอนเปิดแอป) · **ช่วงเตือนตั้งเองได้ต่อคนต่องาน/โครงการ ใน modal ของสิ่งนั้นเลย (ไม่มีในหน้าตั้งค่าแล้ว)** — `DeadlineReminderField` ใน AddTaskModal / TaskDetailModal / CreateProjectModal / EditProjectModal; ตั้งของตัวเองเท่านั้น ไม่กระทบคนอื่นและ **ไม่ต้องขออนุมัติ** (บันทึกทันทีผ่าน `PUT /api/deadline-reminders/:entityType/:entityId`, ตาราง `deadline_reminder` — migration 047, คีย์ = employee+project|task+id; ลบงาน/โครงการแล้วลบแถวตามใน cascade); ไม่มีแถว = ค่าเริ่มต้น เตือนเมื่อเหลือ 2 วัน, `[]` = ปิดการเตือนล่วงหน้าของรายการนั้น; เลือกได้ 1 วัน/3 วัน/7 วัน/1 เดือน/3 เดือน หรือกำหนดเอง 1–365 วัน สูงสุด 6 ช่วง; **ตั้งได้ไม่เกินจำนวนวันระหว่างวันเริ่ม→วันกำหนดส่ง/สิ้นสุดของรายการนั้น** (`reminderLimit` — ไม่มีวันเริ่มนับจากวันนี้, ไม่มีวันกำหนดส่งจะตั้งเตือนไม่ได้เลย; ใน modal ช่วงที่เกินกดไม่ได้ + ช่องกำหนดเองปฏิเสธพร้อมบอกเหตุผล; ตัวสแกนก็ตัดช่วงที่เกินกรอบทิ้งเองด้วย (`effectiveReminderLeads`) เผื่อแก้วันที่ภายหลัง — ยกเว้นค่าเริ่มต้น 2 วัน ที่ไม่ถูกตัด; ฝั่งเซิร์ฟเวอร์ไม่ได้บังคับ เพราะเป็นค่าส่วนตัวและตัวสแกนกันไว้แล้ว); ตอนสร้างงาน/โครงการใหม่จะบันทึกช่วงเตือนก็ต่อเมื่อผู้ใช้เลือกเองเท่านั้น · แต่ละช่วงเตือนครั้งเดียวต่อรายการ **ต่อผู้รับ** (id แจ้งเตือนมี id พนักงานอยู่ด้วยเพราะ `notification.id` เป็น PK ทั้งตาราง ถ้าไม่ใส่ ผู้รับคนที่สองจะไม่ได้รับ) โดยเลือกเฉพาะช่วงที่เล็กที่สุดที่ยังครอบวันที่เหลือ ไม่ยิงทุกช่วงพร้อมกัน และไม่แจ้งซ้ำถ้าเคยเตือนที่ช่วงใกล้กำหนดกว่าไปแล้ว (`closestRemindedLead`); id เก่ารูปแบบ `notif_duesoon_<taskId>` ถือเป็นช่วง 2 วัน จึงไม่เตือนซ้ำงานที่เคยแจ้งไปแล้ว ตรรกะร่วม/ค่าคงที่อยู่ที่ `src/lib/deadlineReminders.ts` (ต้องตรงกับ `server/lib/notificationCategories.ts`); ⚠️ ตัวเลือกช่วงเตือนใน modal ใช้ปุ่ม Escape ปิดเฉพาะแผงเลือก ไม่ปิด modal ด้วยการดัก keydown ที่ระดับ document (capture) เพราะพอลบชิปแล้ว focus หลุดไป `<body>` (`useEscapeToClose` เป็น document listener) อย่าเปลี่ยนกลับไปดักที่ wrapper; นัดประชุมแจ้งเฉพาะ "วันนี้/พรุ่งนี้" แยกต่างหาก

**ระบบสิทธิ์การใช้งาน (Role & Permission)** สร้างขึ้นจริงแล้ว ไม่ใช่แค่ enum เฉยๆ — `AccountType` มี 4 ระดับ: `employee | admin | superadmin | executive` (Super Admin เป็น singleton เดียวในระบบ ตั้งคนใหม่จะลดตำแหน่งคนเก่าอัตโนมัติ; **ผู้บริหาร (executive) มีได้ไม่เกิน 2 คน; Super Admin และผู้บริหารด้วยกันเพิ่ม/ลดตำแหน่งผู้บริหารได้** — บังคับที่เซิร์ฟเวอร์ใน `accountTypeChangeError` ของ `server/routes/employees.ts`, ตั้งคนที่ 3 จะถูกปฏิเสธพร้อมข้อความให้ลดคนเดิมก่อน; admin ธรรมดากำหนดได้แค่ระดับ `employee`; พนักงานธรรมดาแก้ได้เฉพาะรูป/เบอร์/ที่อยู่/อีเมล/การแจ้งเตือนของตัวเอง ไม่ใช่ตำแหน่ง/แผนก/สิทธิ์) ตรรกะสิทธิ์อยู่ที่:
- `src/lib/permissions.ts` — ฝั่ง client: `canManageEmployees`, `canSeeAllProjects` (executive เท่านั้นที่เห็นทุกโครงการโดย default), `canEditOrgStructure`, `canEditOrDeleteTarget`, `isNavAllowedByRole` ฯลฯ
- `src/lib/ownership.ts` — `isResponsibleForProject` (owner หรือ member) ใช้กำหนดมุมมอง "ของฉัน" แบบ default ใน Dashboard/จัดการงานฯ/ปฏิทิน
- `server/lib/ownership.ts` — ฝั่ง server: `isOwner`, `isExecutiveActor` (bypass การขออนุมัติสำหรับ executive) — ใช้จริงใน `projects.ts`/`project-tasks.ts`/`employees.ts`/`credentials.ts` ไม่ใช่แค่ trust client อีกต่อไป · เซิร์ฟเวอร์บังคับให้ตรงกับที่หน้าเว็บซ่อนปุ่ม (2569-09-25): **ลบโครงการ** ได้เฉพาะ admin/superadmin/executive (`isProjectDeleterActor` → 403 ก่อนเช็คเจ้าของ; พนักงานทั่วไปที่เป็นเจ้าของโครงการก็ลบเองไม่ได้), **`DELETE /api/meetings/:id`** ได้เฉพาะผู้สร้างนัดหรือ admin-like (หน้าเว็บไม่เคยเรียก route นี้ — ยกเลิกนัดคือการแก้ status; ส่วนการ *แก้* นัดยังเปิดให้ทุกคนตามเดิม เพราะหน้าเว็บก็ไม่จำกัด), **`POST /api/audit-logs`** อ่านชื่อ/ตำแหน่ง/แผนกจากบัญชีที่ล็อกอิน ไม่ใช้ค่าที่ client ส่งมา (ปลอมชื่อผู้ทำรายการไม่ได้; `id`/`timestamp` ยังมาจาก client) — การอ่านโครงการ/งาน/นัดประชุมยังเปิดทั้งบริษัทโดยตั้งใจ ("ของฉัน" เป็นแค่ค่าเริ่มต้นของหน้าจอ สลับ "ทั้งหมด" ได้ทุกคน) มีแต่เอกสารกับคลังรหัสผ่านที่เซิร์ฟเวอร์กรองให้ · ⚠️ อนุมัติคำขอ "ลบ" โครงการ/งานแล้ว cascade จะลบตัวคำขอเองด้วย จึงไม่มีแถวให้อ่านกลับมา — route `decide` ตอบด้วยแถวที่สร้างจากข้อมูลเดิม (เคย 500 หลังลบสำเร็จแล้ว)
- `server/lib/access.ts` — ใครเห็นอะไร: `loadActorContext`, `canSeeDocument`, `canSeeCredential`, `canAddToProject` — ใช้ทั้งตอนอ่านและตอนแก้/ลบเอกสาร/รหัสผ่าน (ใครเห็นรายการนั้นถึงแก้/ลบได้; ของที่ไม่เห็นตอบ 404)
- ลบโครงการ (`deleteProjectCascade` ใน `projects.ts`) = ลบงาน, ไฟล์/โฟลเดอร์ใน Drive ของโครงการนั้น, และคำขออนุมัติที่เกี่ยวข้องไปด้วย ส่วนรหัสผ่านใน vault ที่ผูกกับโครงการจะ **ไม่ถูกลบ** แต่ย้ายกลับเป็นของส่วนตัวของคนสร้าง; ลบ "สถานะโครงการที่สร้างเอง" ที่ยังมีโครงการใช้อยู่ไม่ได้ (409); เปลี่ยนชื่อฝ่าย/แผนกจะ cascade ไปพนักงาน (และโครงการ/นัดประชุม/vault ทีม สำหรับแผนก) ฝั่งเซิร์ฟเวอร์ใน transaction เดียว
- สร้างโครงการ (`POST /api/projects`): โฟลเดอร์ Drive ของโครงการ (ติ๊ก "สร้างโฟลเดอร์เอกสาร" ใน `CreateProjectModal`) **สร้างพร้อมโครงการใน transaction เดียว** ผ่าน `createFolderName` — ตอบกลับพร้อม `createdFolder` ให้หน้าเว็บเอาไปแสดงใน Drive ทันที (`handleAddProject` คืน `folderCreated`) บันทึกโครงการพังแล้วจะไม่มีโฟลเดอร์ค้าง และกดสร้างซ้ำไม่ได้โฟลเดอร์ซ้ำ (เดิมหน้าเว็บสร้างโฟลเดอร์ก่อนแล้วค่อยสร้างโครงการ) เซิร์ฟเวอร์ยังรับ `id` + `docFolderId` จากแท็บเก่าได้ตามเดิม; ⚠️ เอกสารของโครงการเห็นได้เฉพาะเจ้าของ/สมาชิก — สร้างโครงการโดยไม่ใส่ตัวเองเป็นผู้รับผิดชอบ ผู้สร้างก็ไม่เห็นโฟลเดอร์นั้นใน Drive (กฎเดิม ไม่ใช่บั๊กของขั้นตอนนี้); ป้ายขั้นที่ 3 ของ wizard คือ "ตรวจสอบ" (เป็นแค่หน้าสรุป ยังไม่ได้บันทึก)

**`CredentialVault` (คลังรหัสพนักงาน, route `/vault`) ไม่มีการยืนยันตัวตนชั้นที่สองแยกต่างหากจากการล็อกอินหลัก** — เคยมีแผน/เอกสารเก่าพูดถึงระบบ PIN 4 หลัก + เข้ารหัสข้อมูลด้วย PIN แต่เช็คโค้ดจริงแล้วไม่เคยมีการ implement จริง (ไม่มี `master_password_hash`, ไม่มี `src/utils/crypto.ts`) ทีมตัดสินใจแล้วว่าไม่ต้องการฟีเจอร์นี้ (2569-09-18) — การล็อกอินหลักของระบบคือขอบเขตความปลอดภัยเดียวสำหรับหน้านี้ ความปลอดภัยของข้อมูลจริงตอนนี้อยู่ที่การกรองสิทธิ์ฝั่งเซิร์ฟเวอร์ใน `server/routes/credentials.ts` (ส่วนตัว/ทีม/โครงการ ตาม employee id จริง ไม่ใช่ชื่อที่แสดง)

**สีข้อความ/ไอคอนสีเทา (contrast, ปรับทั้งแอป 2569-09-24 ตรวจด้วย axe-core)** — บนพื้นขาว/พื้นอ่อนห้ามใช้ `text-slate-400`/`text-slate-300` (Tailwind v4 slate-400 = #90a1b9 ได้แค่ 2.6:1) และ `#B0B0B0` ให้ใช้ `text-slate-500` (ข้อความ/ไอคอนจาง; ปุ่มไอคอนให้ `hover:text-slate-800`), `text-[#6F6F6F]` (ข้อความรอง — แทน `#767676` ที่บนพื้น `#F6F6F6`/slate-100 ได้แค่ ~4.2:1), `placeholder:text-[#767676]` (placeholder), และ `#5B6B82` สำหรับสถานะ "ยังไม่เริ่ม" (`TASK_STATUS_COLOR.todo` ใช้ทั้งข้อความป้าย/กราฟ/จุด) ที่ยกเว้นได้: สิ่งที่ `disabled`/`cursor-not-allowed` (WCAG ยกเว้น), ข้อความบนพื้นดำ (sidebar, toast `bg-slate-900`, tooltip — เทาอ่อนอ่านชัดอยู่แล้ว **อย่าทำให้เข้มขึ้น**) ⚠️ ที่ยังไม่ผ่านเกณฑ์และยังไม่ได้ตัดสินใจ: สีส้มแบรนด์ `#FF6537` (ตัวอักษรขาวบนปุ่มส้ม 2.92:1, ตัวอักษรส้มบนขาว 2.92:1 / บนส้มอ่อน `#FFF1EC` 2.65:1) — เป็นเรื่องอัตลักษณ์แบรนด์ ต้องให้เจ้าของตัดสินใจก่อนเปลี่ยน

**ไอคอนใน nav มาจาก 2 แหล่งที่ต่างกัน** ไอคอนส่วนใหญ่มาจาก `lucide-react` แต่เมนู sidebar ส่วนใหญ่ (`NAV_ITEMS` ใน `src/components/layout/Sidebar.tsx`) ใช้ไฟล์ PNG แบบ active/inactive คู่กันจาก `images/new side bar/` ที่ root ของ repo สลับกันตาม route ปัจจุบันและสถานะ hover (เมนู "จัดการพนักงาน" ไม่มีชุด PNG เป็นของตัวเอง ใช้ lucide `Users` แทน) ทรัพยากรแบรนด์ (โลโก้, favicon) ก็อยู่ใน root directory `images/` เช่นกัน ไม่ได้อยู่ใน `src/assets/` ทั้งหมด

**Path alias**: `@/*` ชี้ไปที่ root ของโปรเจกต์ (ไม่ใช่ `src/`) ตั้งค่าไว้ทั้งใน `tsconfig.json` และ `vite.config.ts`

**`vite.config.ts` มีการจัดการ HMR เฉพาะสำหรับ AI Studio** (ตัวแปร env `DISABLE_HMR` ใช้เปิด/ปิด `server.hmr`/`server.watch`) เพื่อลดการกระพริบขณะที่ agent กำลังแก้ไขไฟล์ในสภาพแวดล้อมนั้น — อย่าลบส่วนนี้โดยไม่ตรวจสอบบริบทของการ deploy ก่อน

**`@google/genai` ใน `package.json` ยังไม่ได้ใช้งานจริงใน `src/` หรือ `server/`** เป็นของเหลือจากเทมเพลต AI Studio ดั้งเดิม — `express`/`mysql2`/`bcryptjs`/`resend` ใช้งานจริงทั้งหมดแล้ว (ต่างจากตอนที่ทีมยังไม่มี backend)

**เอกสารอ้างอิงระบบ design ที่มีอยู่แล้ว**: ดู `Design.md` ที่ root ของ repo — เป็นเอกสารที่สรุปมาจากโค้ดจริง (ไม่ใช่ spec ที่บังคับ) ครอบคลุม Login, Sidebar/Header, Employee Management, จัดการงานและโครงการ, เอกสาร Drive, คลังรหัสผ่าน, Reports **ยังไม่ครอบคลุม** แดชบอร์ด, ปฏิทินและตารางเวลา, และ "งานของฉัน" (`/gantt`) — 3 หน้านี้ยังไม่ผ่านการออกแบบรอบใหม่ให้ตรงกับ design system ที่เหลือ

### โครงสร้างโค้ด (Code layout)

- `src/pages/*.tsx` — wrapper ระดับ route แบบบางๆ หนึ่งไฟล์ต่อหนึ่งแท็บ เชื่อม `useAppData()` เข้ากับ component ที่ตรงกันใน `src/components/`
- `src/components/layout/` — `AppLayout` (Header + Sidebar + `<Outlet>` + `TaskModal` แบบ global), `Header`, `Sidebar`
- `src/components/*.tsx` — component แสดงผลหนึ่งตัวต่อหนึ่งแท็บหลัก (`Dashboard`, `CalendarView`, `DocVault`, `CredentialVault`, `MyWorkspace`, `EmployeeManagement`, `EmployeeDirectory`) รวมถึง `Login`, `EmployeeProfileModal`
- `src/components/dashboard/*.tsx` — ชิ้นส่วนแสดงผลย่อยๆ ที่ประกอบกันอยู่ใน `Dashboard.tsx` เท่านั้น
- `src/components/projectBoard/*.tsx` — "จัดการงานและโครงการ" ทั้งโมดูล (`ProjectBoard`, `ProjectDetail`, `ProjectGantt`, `TaskDetailModal`, `CreateProjectModal` ฯลฯ)
- `src/context/AppDataContext.tsx` — state ทั้งหมดของแอปฝั่ง client และการเรียก API ทุกโดเมน (ดูหัวข้อสถาปัตยกรรมด้านบน)
- `src/lib/api.ts` — ฟังก์ชันเรียก API ทั้งหมด (`fetchEmployees`, `createProject`, `updateEmployeeRemote` ฯลฯ) และ `ApiError`
- `src/lib/permissions.ts`, `src/lib/ownership.ts` — ตรรกะสิทธิ์ฝั่ง client (ดูหัวข้อ Role & Permission ด้านบน)
- `src/data/mockData.ts` — seed data ที่ยังใช้เป็น fallback สำหรับบางโดเมน
- `src/types.ts` — โมเดลข้อมูลกลางที่ใช้ร่วมกัน — ทุก component ใช้ type เหล่านี้แทนที่จะสร้าง type ของตัวเอง
- `server/index.ts` — Express app, mount routes ทั้งหมด
- `server/routes/*.ts` — API endpoint แต่ละโดเมน พร้อม authorization check ของตัวเอง
- `server/lib/ownership.ts`, `server/lib/datetime.ts` — helper ฝั่ง server (ownership/permission check, เวลาแบบ Bangkok wall-clock)
- `server/db.ts` — MySQL connection pool (`mysql2`)
- `server/sql/NNN_description.sql` — migration แต่ละไฟล์ รันตามลำดับผ่าน `npm run server:migrate`
- `server/seed*.ts` — สคริปต์ seed ข้อมูลเริ่มต้นแต่ละโดเมน
