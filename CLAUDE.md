# CLAUDE.md

ไฟล์นี้ให้คำแนะนำสำหรับ Claude Code (claude.ai/code) เมื่อทำงานกับโค้ดในโปรเจกต์นี้

## แนวทางการทำงานร่วมกัน (Collaboration guidelines)

- คุยกับผู้ใช้เป็นภาษาไทยโดยภาษาที่เข้าใจง่ายๆ เหมือนคุยกับเพื่อน
- หากติดปัญหา ไม่แน่ใจ หรือไม่ชัดเจนว่าควรทำแบบไหน ให้ถามผู้ใช้ก่อนเสมอ อย่าเดาเอาเอง
- อธิบายให้ผู้ใช้เข้าใจ
- ให้อธิบายเวลาเริ่มทำงานของวัน ต้องอัพเดตกับผู้ใช้ว่าทำอะไรอยู่
- เตือนผู้ใช้เสมอว่าตรงไหนผิด พร้อมทางแก้ไข

## คำสั่ง (Commands)

```
npm run dev       # เปิด Vite dev server ที่พอร์ต 3000 (host 0.0.0.0)
npm run build     # บิลด์เวอร์ชันโปรดักชันด้วย Vite
npm run preview   # พรีวิวเวอร์ชันโปรดักชันที่บิลด์แล้ว
npm run lint      # tsc --noEmit (เช็คชนิดข้อมูลอย่างเดียว ไม่มี linter แยกต่างหาก)
npm run clean     # rm -rf dist server.js
```

โปรเจกต์นี้ไม่มีการตั้งค่า test runner (ไม่มีชุดทดสอบ Jest/Vitest/Playwright ไม่มีสคริปต์ `test`) ให้ใช้ `npm run lint` (`tsc --noEmit`) เป็นการตรวจสอบความถูกต้องอัตโนมัติหลักหลังจากแก้ไขโค้ด

## สถาปัตยกรรม (Architecture)

นี่คือแอป React 19 + TypeScript + Vite + Tailwind CSS v4 แบบ SPA ("Wong Workpath" — ยังคงมีการอ้างอิงชื่อเดิม "UnitySpace" หลงเหลืออยู่ใน localStorage key prefix `unityspace_*` และข้อความ audit-log) เป็นเครื่องมือภายในสำหรับจัดการโปรเจกต์/งาน และคลังเก็บรหัสผ่าน Tailwind v4 เชื่อมต่อผ่าน `@tailwindcss/vite` โดยไม่มีไฟล์ `tailwind.config.*` — theme tokens อยู่ใน `src/index.css` ภายใต้ `@theme`

**การทำ routing ใช้ `react-router-dom` v7** ติดตั้งผ่าน `<BrowserRouter>` ใน `src/main.tsx` ไฟล์ `src/App.tsx` กำหนด route ทั้งหมด: `/login` (เข้าถึงได้แบบสาธารณะ) และ `/dashboard`, `/tasks`, `/gantt`, `/calendar`, `/docs`, `/reports`, `/vault` ซึ่งอยู่หลัง `ProtectedLayoutRoute` ที่จะ redirect ไปหน้า `/login` เมื่อ `currentUser` เป็น null แต่ละ route จะ render page component แบบบางๆ ใน `src/pages/*.tsx` ที่ดึงข้อมูล/handler จาก `useAppData()` แล้วส่งเป็น props ไปยัง component ที่แสดงผลจริงใน `src/components/`

**state ทั้งหมดของแอปอยู่ใน `src/context/AppDataContext.tsx`** เข้าถึงผ่าน hook `useAppData()` (`AppDataProvider` ครอบ router ไว้ใน `App.tsx`) ไม่มี state library อื่นนอกจากนี้ โดยจะเก็บ: การยืนยันตัวตน (`currentUser`), ข้อมูลทุกโดเมน (พนักงาน, งาน, เอกสาร, รหัสผ่าน, คำขอลา, การแจ้งเตือน, audit log) และสถานะเปิด/แก้ไขของ task-modal — รวมถึง handler สำหรับการเปลี่ยนแปลงข้อมูลทั้งหมด (`handleSaveTask`, `handleAddCredential` ฯลฯ)

**การเก็บข้อมูลใช้ localStorage ไม่ใช่ backend** เมื่อ mount แล้ว `AppDataContext` จะอ่านข้อมูลแต่ละโดเมนจาก `localStorage` (คีย์ขึ้นต้นด้วย `unityspace_*` เช่น `unityspace_tasks`, `unityspace_employees`) และจะใช้ seed data ใน `src/data/mockData.ts` แทนถ้ายังไม่มีข้อมูลเก็บไว้ ทุกการเปลี่ยนแปลงข้อมูลจะผ่าน helper `saveX` (`saveTasks`, `saveDocs`, `saveCredentials`, `saveLeaves`, `saveNotifications`) ที่อัปเดต state และเขียนกลับไปยัง `localStorage` key เดิมในขั้นตอนเดียว — ไม่มี server/API layer แม้ว่า `express` และ `@google/genai` จะปรากฏใน `package.json` (เป็นของเหลือจากเทมเพลต AI Studio ดั้งเดิม ไม่มีการ import ใช้งานจริงใน `src/`)

**ระบบยืนยันตัวตนเป็นการ mock login ไม่ใช่ authentication จริง** `src/components/Login.tsx` จะจับคู่อีเมลที่กรอกกับ array `employees` จาก mock data (รหัสผ่านอะไรก็ผ่านหมด) และขับเคลื่อน flow ลืมรหัสผ่าน/OTP ที่เป็น UI เท่านั้น id ของผู้ใช้ที่ล็อกอินจะถูกเก็บไว้ใน `localStorage` (`unityspace_current_user_id`) และถูกกู้คืนโดย `AppDataContext` เมื่อโหลดหน้าใหม่ (ควบคุมด้วย `isRestoringSession` เพื่อไม่ให้ route กระพริบไปที่หน้า login)

**`CredentialVault` (คลังรหัสพนักงาน, route `/vault`) ไม่มีการยืนยันตัวตนชั้นที่สองแยกต่างหากจากการล็อกอินหลัก** — เคยมีแผน/เอกสารเก่าพูดถึงระบบ PIN 4 หลัก + เข้ารหัสข้อมูลด้วย PIN แต่เช็คโค้ดจริงแล้วไม่เคยมีการ implement จริง (ไม่มี `master_password_hash`, ไม่มี `src/utils/crypto.ts`) ทีมตัดสินใจแล้วว่าไม่ต้องการฟีเจอร์นี้ (2569-09-18) — การล็อกอินหลักของระบบคือขอบเขตความปลอดภัยเดียวสำหรับหน้านี้ ความปลอดภัยของข้อมูลจริงตอนนี้อยู่ที่การกรองสิทธิ์ฝั่งเซิร์ฟเวอร์ใน `server/routes/credentials.ts` (ส่วนตัว/ทีม/โครงการ ตาม employee id จริง ไม่ใช่ชื่อที่แสดง)

**ไอคอนใน nav มาจาก 2 แหล่งที่ต่างกัน** ไอคอนส่วนใหญ่มาจาก `lucide-react` แต่เมนู sidebar ทั้ง 7 รายการ (`NAV_ITEMS` ใน `src/components/layout/Sidebar.tsx`) ใช้ไฟล์ PNG แบบ active/inactive คู่กันจาก `images/icon menu/` ที่ root ของ repo สลับกันตาม route ปัจจุบันและสถานะ hover ทรัพยากรแบรนด์ (โลโก้, favicon) ก็อยู่ใน root directory `images/` เช่นกัน ไม่ได้อยู่ใน `src/assets/`

**Path alias**: `@/*` ชี้ไปที่ root ของโปรเจกต์ (ไม่ใช่ `src/`) ตั้งค่าไว้ทั้งใน `tsconfig.json` และ `vite.config.ts`

**`vite.config.ts` มีการจัดการ HMR เฉพาะสำหรับ AI Studio** (ตัวแปร env `DISABLE_HMR` ใช้เปิด/ปิด `server.hmr`/`server.watch`) เพื่อลดการกระพริบขณะที่ agent กำลังแก้ไขไฟล์ในสภาพแวดล้อมนั้น — อย่าลบส่วนนี้โดยไม่ตรวจสอบบริบทของการ deploy ก่อน

### โครงสร้างโค้ด (Code layout)

- `src/pages/*.tsx` — wrapper ระดับ route แบบบางๆ หนึ่งไฟล์ต่อหนึ่งแท็บ เชื่อม `useAppData()` เข้ากับ component ที่ตรงกันใน `src/components/`
- `src/components/layout/` — `AppLayout` (Header + Sidebar + `<Outlet>` + `TaskModal` แบบ global), `Header`, `Sidebar`
- `src/components/*.tsx` — component แสดงผลหนึ่งตัวต่อหนึ่งแท็บหลัก (`Dashboard`, `TaskListView`, `GanttChart`, `CalendarView`, `DocVault`, `CredentialVault`) รวมถึง `Login` และ `TaskModal`
- `src/components/dashboard/*.tsx` — ชิ้นส่วนแสดงผลย่อยๆ ที่ประกอบกันอยู่ใน `Dashboard.tsx` เท่านั้น
- `src/context/AppDataContext.tsx` — state ทั้งหมดของแอป, การ sync กับ localStorage, และ audit logging (ดูหัวข้อสถาปัตยกรรมด้านบน)
- `src/data/mockData.ts` — seed data สำหรับทุกโดเมนใน `src/types.ts` (Employee, Task, LinkedDoc, CredentialItem, LeaveRequest, Notification)
- `src/types.ts` — โมเดลข้อมูลกลางที่ใช้ร่วมกัน — ทุก component ใช้ type เหล่านี้แทนที่จะสร้าง type ของตัวเอง
