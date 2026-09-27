# Wong Workpath — ชุดเอกสารโครงการ

เอกสารชุดนี้อธิบายระบบ **Wong Workpath** เครื่องมือภายในบริษัทสำหรับจัดการโครงการ/งาน/นัดประชุม/เอกสาร/รหัสผ่าน/พนักงาน ใช้งานจริงทุกวันโดยพนักงานจริง (ไม่ใช่ mock/demo) เนื้อหาทุกไฟล์เขียนขึ้นจากการอ่านโค้ดจริงและฐานข้อมูลจริงของระบบ ณ วันที่จัดทำ (2569-09-25) ไม่ใช่ข้อมูลสมมติ

> ⚠️ **ระบบนี้มีข้อมูลจริงของพนักงานจริงอยู่** เครื่องพัฒนาและระบบจริง (production) ต่อฐานข้อมูล MySQL ตัวเดียวกัน อ่าน [Setup_Deployment_Guide.md](./Setup_Deployment_Guide.md) และ [Development_Environment.md](./Development_Environment.md) ก่อนแก้ไขหรือทดสอบสิ่งใดในระบบ

## สารบัญ

| เอกสาร | เนื้อหา | เหมาะกับ |
|---|---|---|
| [Introduction.md](./Introduction.md) | ระบบนี้คืออะไร ทำไมถึงสร้าง | ทุกคน |
| [Project_Overview.md](./Project_Overview.md) | ภาพรวมโมดูล/ฟีเจอร์/บทบาทผู้ใช้ | ทุกคน |
| [SRS.md](./SRS.md) | ข้อกำหนดความต้องการ (Functional/Non-Functional) | ทีมพัฒนา, ผู้บริหาร |
| [ER_Diagram.md](./ER_Diagram.md) | โครงสร้างฐานข้อมูล (ER Diagram) | ทีมพัฒนา |
| [Class_Diagram.md](./Class_Diagram.md) | โครงสร้างข้อมูลฝั่งโค้ด (TypeScript types) | ทีมพัฒนา |
| [Data_Dictionary.md](./Data_Dictionary.md) | รายละเอียดทุกคอลัมน์ของทุกตาราง | ทีมพัฒนา |
| [Flowchart.md](./Flowchart.md) | ผังขั้นตอนการทำงานหลักของระบบ | ทีมพัฒนา, ผู้ใช้งาน |
| [Master_Data.md](./Master_Data.md) | ค่าคงที่/ข้อมูลอ้างอิงของระบบ | ทีมพัฒนา |
| [Development_Environment.md](./Development_Environment.md) | วิธีตั้งเครื่องพัฒนา, คำสั่งที่ใช้บ่อย | ทีมพัฒนา |
| [Setup_Deployment_Guide.md](./Setup_Deployment_Guide.md) | วิธี deploy ขึ้นระบบจริง | ทีมพัฒนา, DevOps |
| [API_Documentation.md](./API_Documentation.md) | รายการ REST API ทั้งหมด | ทีมพัฒนา |
| [User_Manual.md](./User_Manual.md) | คู่มือการใช้งานสำหรับพนักงาน | พนักงานผู้ใช้งาน |
| [Test_Cases.md](./Test_Cases.md) | ชุดทดสอบหลักของระบบ | ทีมพัฒนา, QA |

## สรุปเทคโนโลยีที่ใช้ (อ่านเพิ่มใน Development_Environment.md)

- **Frontend:** React 19, TypeScript, Vite 6, Tailwind CSS v4, React Router v7, Motion, Lucide
- **Backend:** Express 4, MySQL (mysql2), bcryptjs, Resend (อีเมล)
- **Deploy จริง:** Vercel (frontend) + Render (backend, แพลนฟรี) + MySQL ตัวเดียวที่ใช้ร่วมกับเครื่องพัฒนา

## คำสั่งเริ่มต้นเร็ว

```
npm install
npm run dev:all      # เปิด frontend (3000) + backend (4000) พร้อมกันบนเครื่องพัฒนา
npm run lint         # tsc --noEmit — การตรวจสอบอัตโนมัติหลักของโปรเจกต์ (ไม่มี test runner แยก)
```

รายละเอียดคำสั่งทั้งหมดและตัวแปรแวดล้อมที่ต้องตั้ง อยู่ใน [Development_Environment.md](./Development_Environment.md)
