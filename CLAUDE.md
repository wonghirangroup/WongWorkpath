# CLAUDE.md

ไฟล์นี้ให้คำแนะนำสำหรับ Claude Code (claude.ai/code) เมื่อทำงานกับโค้ดในโปรเจกต์นี้

## แนวทางการทำงานร่วมกัน (Collaboration guidelines)

- คุยกับผู้ใช้เป็นภาษาไทยโดยภาษาที่เข้าใจง่ายๆ เหมือนคุยกับเพื่อน
- หากติดปัญหา ไม่แน่ใจ หรือไม่ชัดเจนว่าควรทำแบบไหน ให้ถามผู้ใช้ก่อนเสมอ อย่าเดาเอาเอง
- อธิบายให้ผู้ใช้เข้าใจ
- ให้อธิบายเวลาเริ่มทำงานของวัน ต้องอัพเดตกับผู้ใช้ว่าทำอะไรอยู่
- เตือนผู้ใช้เสมอว่าตรงไหนผิด พร้อมทางแก้ไข

## ⚠️ เครื่อง dev คือ production จริง ห้ามฆ่า process แบบกว้างๆ

**`npm run dev` (พอร์ต 3000) และ `npm run server:dev` (พอร์ต 4000) ที่รันอยู่บนเครื่องนี้คือบริการจริงที่พนักงานใช้งานอยู่ทุกวัน ไม่มี deployment แยกต่างหาก** ไม่มี auto-restart, ไม่มี process manager — ถ้า process ตาย ระบบล่มทันทีจนกว่าจะมีคนสั่งรันใหม่ด้วยมือ

- **ห้าม** รันคำสั่งฆ่า process แบบกว้างๆ เช่น `taskkill //F //IM node.exe //T` (จะฆ่าทั้ง dev server และ backend ที่ผู้ใช้จริงพึ่งพาอยู่ — เคยเกิดเหตุการณ์นี้มาแล้วในอดีต ทำให้ระบบล่มโดยไม่ตั้งใจระหว่างการทดสอบ)
- ถ้าจำเป็นต้องเริ่ม server ที่ยังไม่ได้รัน ให้ **สั่งรันเพิ่ม** เท่านั้น อย่าฆ่าของเดิมก่อน
- ก่อนทดสอบ/ทำความสะอาดอะไรก็ตามที่เกี่ยวกับ process ให้ตรวจสอบก่อนว่ากำลังจะกระทบ process ที่ผู้ใช้จริงพึ่งพาอยู่หรือไม่
- นี่คือความเสี่ยงเชิงระบบที่ควรแก้ในระยะยาวด้วยการ `npm run build` แล้ว deploy ขึ้น hosting จริงแยกจากเครื่องพัฒนา แต่ยังไม่ได้ทำ

## คำสั่ง (Commands)

```
npm run dev                        # เปิด Vite dev server ที่พอร์ต 3000 (host 0.0.0.0) — ฝั่ง frontend ของบริการจริง
npm run server:dev                 # เปิด Express API server ที่พอร์ต 4000 พร้อม hot-reload (tsx watch) — ฝั่ง backend ของบริการจริง
npm run dev:all                    # รันทั้ง dev + server:dev พร้อมกันด้วย concurrently
npm run server:start               # รัน API server แบบ production (ไม่มี watch) — ยังไม่ได้ใช้จริง เพราะไม่มี deployment แยก
npm run build                      # บิลด์เวอร์ชันโปรดักชันด้วย Vite (ฝั่ง frontend เท่านั้น)
npm run preview                    # พรีวิวเวอร์ชันโปรดักชันที่บิลด์แล้ว
npm run lint                       # tsc --noEmit (เช็คชนิดข้อมูลอย่างเดียว ไม่มี linter แยกต่างหาก)
npm run clean                      # rm -rf dist server.js
npm run server:migrate             # รัน migration SQL ทั้งหมดใน server/sql/*.sql ตามลำดับ
npm run server:seed                # seed ข้อมูลเริ่มต้น (โปรเจกต์/งาน ฯลฯ)
npm run server:seed-employees      # seed ข้อมูลพนักงานเริ่มต้น
npm run server:seed-credentials    # seed ข้อมูลคลังรหัสผ่านเริ่มต้น
npm run server:seed-employee-logins # seed บัญชีล็อกอินของพนักงาน (username/password hash)
```

โปรเจกต์นี้ไม่มีการตั้งค่า test runner (ไม่มีชุดทดสอบ Jest/Vitest/Playwright ไม่มีสคริปต์ `test`) ให้ใช้ `npm run lint` (`tsc --noEmit`) เป็นการตรวจสอบความถูกต้องอัตโนมัติหลักหลังจากแก้ไขโค้ด สำหรับการตรวจสอบพฤติกรรมจริงในเบราว์เซอร์ แนวทางที่ใช้ประจำคือติดตั้ง `playwright` แบบชั่วคราว (`npm install --no-save playwright`) เขียนสคริปต์ทดสอบแบบ throwaway ที่ล็อกอินจริงและสร้าง/ลบข้อมูลทดสอบของตัวเอง แล้วถอนการติดตั้งออกหลังใช้เสร็จ

## สถาปัตยกรรม (Architecture)

นี่คือแอป **React 19 + TypeScript + Vite + Tailwind CSS v4** ฝั่ง frontend คู่กับ **Express + MySQL** ฝั่ง backend ("Wong Workpath" — ยังคงมีการอ้างอิงชื่อเดิม "UnitySpace" หลงเหลืออยู่ใน localStorage key prefix `unityspace_*` และข้อความ audit-log) เป็นเครื่องมือภายในบริษัทสำหรับจัดการโปรเจกต์/งาน/นัดประชุม/เอกสาร/รหัสผ่าน/พนักงาน ใช้งานจริงทุกวันโดยพนักงานจริง (ไม่ใช่ mock/demo) Tailwind v4 เชื่อมต่อผ่าน `@tailwindcss/vite` โดยไม่มีไฟล์ `tailwind.config.*` — theme tokens อยู่ใน `src/index.css` ภายใต้ `@theme`

**Backend เป็นของจริง ไม่ใช่ localStorage-only แล้ว** — `server/index.ts` เป็น Express app เชื่อมต่อ MySQL จริงผ่าน `server/db.ts` (`mysql2`) ตาราง/route หลักที่มีอยู่ใน `server/routes/`: `auth.ts` (ล็อกอินจริงด้วย bcrypt + ระบบลืมรหัสผ่าน/OTP ผ่าน `resend`), `employees.ts`, `projects.ts`, `project-tasks.ts`, `project-custom-statuses.ts`, `documents.ts`, `credentials.ts`, `meetings.ts`, `notifications.ts`, `change-requests.ts` แต่ละ route มี authorization check ของตัวเอง (ดูหัวข้อ Role & Permission ด้านล่าง) ไม่ใช่ trust client เหมือนเวอร์ชันแรกๆ ของโปรเจกต์ Migration อยู่ที่ `server/sql/NNN_description.sql` รันผ่าน `npm run server:migrate`; ข้อมูลเริ่มต้นอยู่ใน `server/seed*.ts`

**ระบบยืนยันตัวตนเป็นของจริง ไม่ใช่ mock login แล้ว** — `src/components/Login.tsx` เรียก `POST /api/auth/login` ซึ่งเช็ครหัสผ่านจริงด้วย `bcrypt.compare` กับ `login.password_hash` ในฐานข้อมูล (ไม่ใช่ "รหัสผ่านอะไรก็ผ่านหมด" เหมือนเวอร์ชันแรกของโปรเจกต์อีกต่อไป) flow ลืมรหัสผ่าน/OTP ก็ต่อกับ backend จริงผ่าน `server/routes/auth.ts` + `resend` (ส่งอีเมลจริง ถ้ามี `RESEND_API_KEY`) id ของผู้ใช้ที่ล็อกอินจะถูกเก็บไว้ใน `localStorage` (`unityspace_current_user_id`) เพื่อกู้คืน session เมื่อโหลดหน้าใหม่เท่านั้น (ควบคุมด้วย `isRestoringSession` ใน `AppDataContext`)

**การทำ routing ใช้ `react-router-dom` v7** ติดตั้งผ่าน `<BrowserRouter>` ใน `src/main.tsx` ไฟล์ `src/App.tsx` กำหนด route ทั้งหมด: `/login` (เข้าถึงได้แบบสาธารณะ) และ `/dashboard`, `/tasks`, `/gantt`, `/calendar`, `/docs`, `/vault`, `/employees`, `/settings` ซึ่งอยู่หลัง `ProtectedLayoutRoute` ที่จะ redirect ไปหน้า `/login` เมื่อ `currentUser` เป็น null ทุก route (ยกเว้น `/dashboard` และ `/settings` ที่เปิดให้ทุกบัญชีเสมอและ admin จำกัดรายคนไม่ได้) ยังผ่าน `NavGuardRoute` ที่บล็อกการเข้าถึงตรงด้วย URL หากสิทธิ์ของบัญชีนั้นไม่อนุญาต (เช็คเดียวกับที่ Sidebar ใช้ซ่อนลิงก์) **หมายเหตุ**: `/gantt` ไม่ได้แสดง Gantt chart แบบเดิมแล้ว แต่ render `MyWorkspace` ("งานของฉัน" — มุมมองงาน/โครงการ/Timeline ของผู้ใช้คนนั้นเอง ข้ามหลายโครงการ) แต่ละ route จะ render page component แบบบางๆ ใน `src/pages/*.tsx` ที่ดึงข้อมูล/handler จาก `useAppData()` แล้วส่งเป็น props ไปยัง component ที่แสดงผลจริงใน `src/components/`

**state ฝั่ง client ทั้งหมดอยู่ใน `src/context/AppDataContext.tsx`** เข้าถึงผ่าน hook `useAppData()` (`AppDataProvider` ครอบ router ไว้ใน `App.tsx`) ไม่มี state library อื่นนอกจากนี้ **โดเมนส่วนใหญ่ดึงข้อมูลจริงจาก API ผ่าน `src/lib/api.ts`** (พนักงาน, โครงการ, งาน, เอกสาร, รหัสผ่าน, นัดประชุม, การแจ้งเตือน, คำขออนุมัติแก้ไข/ลบ) แล้วเก็บผลไว้ใน React state — ทุกการเปลี่ยนแปลงข้อมูลเรียก API จริง (`handleSaveTask`, `handleAddCredential`, `handleUpdateEmployee` ฯลฯ) ไม่ได้เขียนกลับ localStorage เป็นหลักแหล่งข้อมูลอีกต่อไป

**แต่ยังมี 3 โดเมนที่เป็น localStorage-only จริงๆ ไม่มี backend รองรับ** (เขียน/อ่านตรงใน `AppDataContext.tsx`, คีย์ขึ้นต้นด้วย `unityspace_*`):
- `unityspace_org_divisions` — โครงสร้างองค์กร (ฝ่าย/แผนก) ที่แก้ไขได้ใน Employee Management → "โครงสร้างองค์กร"
- `unityspace_audit_logs` — บันทึกกิจกรรม (audit log) ที่แสดงในหน้า "จัดการพนักงาน" → "บันทึกกิจกรรม (Log)" และในโปรไฟล์พนักงานแต่ละคน
- `unityspace_tasks` — ระบบงานเก่าแบบ mock (`Task[]` ใน `types.ts`) ที่ไม่ใช่ระบบงานจริงที่ใช้งานอยู่ (ระบบงานจริงคือ `projectTasks`/`ProjectTaskItem[]` ซึ่งมาจาก `project_task` table ผ่าน `server/routes/project-tasks.ts`) — เป็นตัวเก่าที่ค้างอยู่ ไม่ควรสร้างฟีเจอร์ใหม่บนตัวนี้

**ระบบสิทธิ์การใช้งาน (Role & Permission)** สร้างขึ้นจริงแล้ว ไม่ใช่แค่ enum เฉยๆ — `AccountType` มี 4 ระดับ: `employee | admin | superadmin | executive` (Super Admin เป็น singleton เดียวในระบบ ตั้งคนใหม่จะลดตำแหน่งคนเก่าอัตโนมัติ) ตรรกะสิทธิ์อยู่ที่:
- `src/lib/permissions.ts` — ฝั่ง client: `canManageEmployees`, `canSeeAllProjects` (executive เท่านั้นที่เห็นทุกโครงการโดย default), `canEditOrgStructure`, `canEditOrDeleteTarget`, `isNavAllowedByRole` ฯลฯ
- `src/lib/ownership.ts` — `isResponsibleForProject` (owner หรือ member) ใช้กำหนดมุมมอง "ของฉัน" แบบ default ใน Dashboard/จัดการงานฯ/ปฏิทิน
- `server/lib/ownership.ts` — ฝั่ง server: `isOwner`, `isExecutiveActor` (bypass การขออนุมัติสำหรับ executive) — ใช้จริงใน `projects.ts`/`project-tasks.ts`/`employees.ts`/`credentials.ts` ไม่ใช่แค่ trust client อีกต่อไป

**`CredentialVault` (คลังรหัสพนักงาน, route `/vault`) ไม่มีการยืนยันตัวตนชั้นที่สองแยกต่างหากจากการล็อกอินหลัก** — เคยมีแผน/เอกสารเก่าพูดถึงระบบ PIN 4 หลัก + เข้ารหัสข้อมูลด้วย PIN แต่เช็คโค้ดจริงแล้วไม่เคยมีการ implement จริง (ไม่มี `master_password_hash`, ไม่มี `src/utils/crypto.ts`) ทีมตัดสินใจแล้วว่าไม่ต้องการฟีเจอร์นี้ (2569-09-18) — การล็อกอินหลักของระบบคือขอบเขตความปลอดภัยเดียวสำหรับหน้านี้ ความปลอดภัยของข้อมูลจริงตอนนี้อยู่ที่การกรองสิทธิ์ฝั่งเซิร์ฟเวอร์ใน `server/routes/credentials.ts` (ส่วนตัว/ทีม/โครงการ ตาม employee id จริง ไม่ใช่ชื่อที่แสดง)

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
- `src/context/AppDataContext.tsx` — state ทั้งหมดของแอปฝั่ง client, การเรียก API, การ sync กับ localStorage สำหรับ 3 โดเมนที่ยังไม่มี backend, และ audit logging (ดูหัวข้อสถาปัตยกรรมด้านบน)
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
