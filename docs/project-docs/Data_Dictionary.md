# Data Dictionary

ดึงจากฐานข้อมูล MySQL จริงตรงๆ ผ่าน `information_schema.COLUMNS` และ `KEY_COLUMN_USAGE` วันที่ 2569-09-25 ครบทั้ง 16 ตาราง คอลัมน์ `Key` ใช้ `PRI` = Primary Key, `UNI` = Unique Key, `MUL` = มี index/FK (ไม่ unique)

## employee — บัญชีพนักงาน

| คอลัมน์ | ชนิด | Null ได้ | Key | ค่าเริ่มต้น | คำอธิบาย |
|---|---|---|---|---|---|
| id | varchar(64) | ไม่ | PK | — | รหัสพนักงาน เช่น `E01` |
| name | varchar(255) | ไม่ | — | — | ชื่อ-นามสกุลจริง |
| email | varchar(255) | ได้ | UNI | — | อีเมลติดต่อ ใช้สำหรับ OTP ลืมรหัสผ่าน (ไม่ใช่ username) |
| role | varchar(255) | ไม่ | — | — | ตำแหน่งงาน |
| department | varchar(64) | ไม่ | — | — | แผนก (ชื่อจริงจากผังองค์กร) |
| avatar | mediumtext | ได้ | — | — | รูปโปรไฟล์ (data URL) |
| max_workload | int unsigned | ไม่ | — | 0 | ภาระงานสูงสุด (ยังไม่ถูกใช้งานจริงในตรรกะปัจจุบัน) |
| is_admin | tinyint(1) | ไม่ | — | 0 | ค่าเดิมก่อนมี `account_type` — ไม่ใช่แหล่งความจริงหลักแล้ว |
| nickname | varchar(255) | ได้ | — | — | ชื่อเล่นที่แสดงผล |
| division | varchar(64) | ได้ | — | — | ฝ่ายจากผังองค์กร |
| account_type | varchar(16) | ไม่ | — | `employee` | ระดับสิทธิ์: employee/admin/superadmin/executive |
| restricted_menu_ids | text | ได้ | — | — | รายการ id เมนูที่ถูกจำกัดเฉพาะคนนี้ (JSON) |
| phone | varchar(32) | ได้ | — | — | เบอร์โทร |
| address | text | ได้ | — | — | ที่อยู่ |
| muted_notification_categories | text | ได้ | — | — | หมวดแจ้งเตือนที่ปิดไว้ (JSON) |
| created_at / updated_at | datetime | ไม่ | — | now() | เวลาสร้าง/แก้ไขล่าสุด |

## login — บัญชีเข้าสู่ระบบ

| คอลัมน์ | ชนิด | Null ได้ | Key | คำอธิบาย |
|---|---|---|---|---|
| id | int unsigned, auto_increment | ไม่ | PK | — |
| employee_id | varchar(64) | ได้ | MUL → employee.id | เจ้าของบัญชี |
| email | varchar(255) | ได้ | UNI | สำเนาอีเมลสำหรับ OTP |
| password_hash | varchar(255) | ไม่ | — | รหัสผ่านแบบ bcrypt hash |
| is_active | tinyint(1) | ไม่ (default 1) | — | ปิดใช้งานบัญชีได้โดยไม่ต้องลบ |
| last_login_at | datetime | ได้ | — | เข้าสู่ระบบล่าสุด |
| username | varchar(255) | ไม่ | UNI | ชื่อผู้ใช้สำหรับล็อกอิน |
| password_changed_at | datetime | ได้ | — | ใช้จำกัดเปลี่ยนรหัสผ่านวันละ 1 ครั้ง (เฉพาะเปลี่ยนเอง ไม่รวม admin รีเซ็ตให้) |

## project — โครงการ

| คอลัมน์ | ชนิด | Null ได้ | Key | คำอธิบาย |
|---|---|---|---|---|
| id | varchar(20) | ไม่ | PK | รูปแบบ `PROJ_<timestamp>` |
| code | varchar(40) | ไม่ | UNI | รหัสแสดงผล เช่น `GS-69-P-001` |
| title | varchar(255) | ไม่ | — | ชื่อโครงการ |
| description | text | ได้ | — | รายละเอียด |
| department | varchar(150) | ได้ | — | แผนกที่สังกัด |
| priority | varchar(10) | ได้ | — | ระดับความสำคัญ 1–5 |
| budget | decimal(14,2) | ได้ | — | งบประมาณ (บาท) |
| progress | int | ได้ | — | ความคืบหน้า % |
| start_date / end_date | date | ได้ | — | ช่วงเวลาโครงการ |
| status | varchar(20) | ไม่ (default `draft`) | — | draft/pending_review/in_progress/on_hold/completed/cancelled/idea |
| created_by | varchar(64) | ได้ | MUL → employee.id | ผู้สร้างโครงการ |
| member_employee_ids | text | ได้ | — | ผู้รับผิดชอบร่วม (JSON, ไม่ใช่ FK จริง) |
| owner_employee_ids | text | ได้ | — | ผู้รับผิดชอบหลัก (JSON, ไม่ใช่ FK จริง) |
| member_duties | text | ได้ | — | หน้าที่ของสมาชิกแต่ละคน (JSON object) |
| doc_folder_id | varchar(64) | ได้ | — | โฟลเดอร์ Drive ของโครงการนี้ |
| type | varchar(10) | ได้ | — | P/SP/I/C/B/FND หรือรหัสประเภทที่สร้างเอง |
| abbreviation | varchar(20) | ได้ | — | ตัวย่อชื่อโครงการ |
| parent_project_id | varchar(20) | ได้ | MUL → project.id | โครงการหลัก (เฉพาะประเภท SP) |

## project_task — งาน

| คอลัมน์ | ชนิด | Null ได้ | Key | คำอธิบาย |
|---|---|---|---|---|
| id | varchar(30) | ไม่ | PK | รูปแบบ `PTASK_...` |
| project_id | varchar(20) | ไม่ | MUL → project.id | โครงการที่งานนี้สังกัด |
| title / description | varchar(255) / text | ไม่/ได้ | — | ชื่อ/รายละเอียดงาน |
| status | varchar(20) | ไม่ (default `todo`) | — | todo/in_progress/review/blocked/done |
| priority | varchar(10) | ได้ | — | 1–5 |
| assignee_employee_ids | text | ได้ | — | ผู้รับผิดชอบ (JSON, ไม่ใช่ FK จริง) |
| reviewer_employee_ids | text | ได้ | — | ผู้ตรวจ (JSON, ไม่ใช่ FK จริง) |
| creator_employee_id | varchar(64) | ได้ | MUL → employee.id | ผู้สร้างงาน |
| start_date / due_date | date | ได้ | — | ช่วงเวลาของงาน |
| progress | int | ไม่ (default 0) | — | ความคืบหน้า % |
| checklist | text | ได้ | — | รายการเช็คลิสต์ย่อย (JSON) |
| submission_note / submission_file_ids | text | ได้ | — | บันทึก/ไฟล์แนบตอนส่งงาน |
| review_note | text | ได้ | — | เหตุผลตอนตรวจงาน (โดยเฉพาะตอนตีกลับ) |
| blocked_reason | text | ได้ | — | เหตุผลตอนติดปัญหา |
| parent_task_id | varchar(30) | ได้ | MUL → project_task.id | งานหลัก ถ้าเป็นงานย่อย |

## meeting — นัดประชุม

| คอลัมน์ | ชนิด | Null ได้ | Key | คำอธิบาย |
|---|---|---|---|---|
| id | varchar(30) | ไม่ | PK | — |
| project_id | varchar(20) | ได้ | MUL → project.id | ไม่บังคับต้องผูกโครงการ |
| task_id | varchar(30) | ได้ | MUL → project_task.id | ผูกกับงานเฉพาะ (ไม่บังคับ) |
| title / description | varchar(255) / text | ไม่/ได้ | — | หัวข้อ/รายละเอียดนัด |
| date | date | ไม่ | — | วันที่ประชุม |
| start_time / end_time | varchar(5) | ไม่/ได้ | — | เวลาเริ่ม/สิ้นสุด (HH:mm) |
| attendee_ids | text | ได้ | — | ผู้เข้าร่วม (JSON, ไม่ใช่ FK จริง) |
| location / location_link | varchar | ได้ | — | สถานที่/ลิงก์แผนที่ |
| meeting_link | text | ได้ | — | ลิงก์ประชุมออนไลน์ |
| created_by | varchar(64) | ได้ | MUL → employee.id | ผู้สร้างนัด (ใช้ตัดสินสิทธิ์ลบทิ้งถาวรด้วย) |
| status | enum | ไม่ (default `scheduled`) | — | scheduled/cancelled |
| cancellation_reason | text | ได้ | — | เหตุผลตอนยกเลิก |
| department | varchar(255) | ได้ | — | แผนกที่จัดประชุม |

## document — เอกสาร Drive

| คอลัมน์ | ชนิด | Null ได้ | Key | คำอธิบาย |
|---|---|---|---|---|
| id | varchar(30) | ไม่ | PK | — |
| name | varchar(255) | ไม่ | — | ชื่อไฟล์/โฟลเดอร์/ลิงก์ |
| kind | enum | ไม่ | — | folder/file/link |
| parent_id | varchar(30) | ได้ | MUL → document.id | โฟลเดอร์แม่ (สร้างโครงสร้างต้นไม้) |
| url | text | ได้ | — | ลิงก์ (kind=link) |
| file_data_url | longtext | ได้ | — | ไฟล์แบบ base64 data URL (kind=file) |
| file_mime_type / file_size | varchar / int | ได้ | — | ชนิดไฟล์ / ขนาด (byte) |
| scope | enum | ไม่ (default `ส่วนตัว`) | — | ส่วนตัว/โครงการ |
| project_id | varchar(30) | ได้ | MUL (ไม่มี FK บังคับจริง) | โครงการที่เอกสารนี้สังกัด (เมื่อ scope=โครงการ) |
| task_id | varchar(30) | ได้ | — (ไม่มี FK บังคับจริง) | งานที่เอกสารนี้ผูกอยู่ (ถ้ามี) |
| creator_employee_id | varchar(64) | ได้ | MUL → employee.id | ผู้สร้าง — ใช้ตัดสินสิทธิ์เห็นของ scope=ส่วนตัว |
| version | int | ไม่ (default 1) | — | เลขเวอร์ชัน |
| history | longtext | ได้ | — | ประวัติการแก้ไข (JSON array) |
| last_updated / updated_by | datetime / varchar | ไม่ | — | แก้ไขล่าสุดเมื่อไหร่/โดยใคร (ชื่อแสดงผล) |

## credential — คลังรหัสผ่าน

| คอลัมน์ | ชนิด | Null ได้ | Key | คำอธิบาย |
|---|---|---|---|---|
| id | varchar(64) | ไม่ | PK | — |
| label | varchar(255) | ไม่ | — | ชื่อรายการ |
| type | enum | ไม่ | — | Username & Password / API Key / Bank Account / Access Token |
| scope | enum | ไม่ (default `ส่วนตัว`) | — | ส่วนตัว/ทีม/โครงการ |
| team | varchar(255) | ได้ | — | ชื่อแผนก (เมื่อ scope=ทีม) |
| username / password / key_value | varchar / text | ผสม | — | ข้อมูลลับ — **ไม่ได้เข้ารหัสระดับแอป** เก็บเป็นข้อความธรรมดาในฐานข้อมูล |
| notes / url / logo_url | text/varchar | ได้ | — | รายละเอียดเพิ่มเติม |
| last_viewed_at | datetime | ได้ | — | เปิดดูล่าสุดเมื่อไหร่ |
| created_by | varchar(255) | ไม่ | — | ชื่อผู้สร้าง (ข้อความแสดงผล ไม่ใช่ id) |
| project_id | varchar(20) | ได้ | — (ไม่มี FK บังคับจริง) | โครงการที่ผูกอยู่ (เมื่อ scope=โครงการ) |
| creator_employee_id | varchar(64) | ได้ | — (ไม่มี FK บังคับจริง) | ผู้สร้างจริง (ใช้กรองสิทธิ์) |

## change_request — คำขออนุมัติแก้ไข/ลบ

| คอลัมน์ | ชนิด | Null ได้ | Key | คำอธิบาย |
|---|---|---|---|---|
| id | varchar(30) | ไม่ | PK | — |
| entity_type | enum | ไม่ | — | project / project_task / employee |
| entity_id | varchar(30) | ไม่ | — (polymorphic, ไม่มี FK) | id ของรายการที่ขอแก้/ลบ |
| request_type | enum | ไม่ | — | edit / delete |
| proposed_changes | longtext | ได้ | — | ค่าที่เสนอแก้ (JSON, เฉพาะ edit) |
| reason | text | ไม่ | — | เหตุผลที่ขอ |
| status | enum | ไม่ (default `pending`) | — | pending / approved / rejected |
| requested_by / decided_by | varchar(64) | ได้ | MUL → employee.id | ผู้ขอ / ผู้ตัดสิน |
| decision_note | text | ได้ | — | หมายเหตุตอนตัดสิน |

## notification — การแจ้งเตือน

| คอลัมน์ | ชนิด | Null ได้ | Key | คำอธิบาย |
|---|---|---|---|---|
| id | varchar(64) | ไม่ | PK | มักฝัง id ผู้รับไว้ในรูปแบบ id เอง กันการแจ้งซ้ำ |
| target_employee_id | varchar(64) | ไม่ | MUL → employee.id | ผู้รับแจ้งเตือน |
| title / message | varchar / text | ไม่ | — | หัวข้อ/เนื้อหา |
| type | enum | ไม่ (default `info`) | — | info/success/warning |
| link_type / link_id | varchar | ได้ | — (polymorphic, ไม่มี FK) | ปลายทางเมื่อกดแจ้งเตือน |
| is_read | tinyint(1) | ไม่ (default 0) | — | อ่านแล้วหรือยัง |
| category | varchar(32) | ได้ | — | assignment/review/blocked/deadline/meeting/approval |

## deadline_reminder — การตั้งเตือนกำหนดส่งส่วนตัว

| คอลัมน์ | ชนิด | Null ได้ | Key | คำอธิบาย |
|---|---|---|---|---|
| employee_id | varchar(64) | ไม่ | PK, → employee.id | เจ้าของการตั้งค่านี้ |
| entity_type | enum | ไม่ | PK | project / task |
| entity_id | varchar(30) | ไม่ | PK (polymorphic, ไม่มี FK) | รายการที่ตั้งเตือน |
| lead_days | varchar(100) | ไม่ | — | รายการจำนวนวันล่วงหน้า (JSON เช่น `[2,7,30]`) |

Primary key เป็นแบบผสม 3 คอลัมน์ (employee_id + entity_type + entity_id) — คนหนึ่งตั้งได้ 1 ค่าต่อ 1 รายการ

## org_division / org_section — ผังองค์กร

| ตาราง | คอลัมน์สำคัญ | คำอธิบาย |
|---|---|---|
| org_division | id PK, name UK, sort_order | ฝ่าย — ชื่อห้ามซ้ำ |
| org_section | id PK, division_id FK→org_division.id, name, sort_order | แผนกภายในฝ่ายนั้น |

## project_custom_status / project_custom_type — ค่าที่ผู้ใช้สร้างเอง

| ตาราง | คอลัมน์สำคัญ | คำอธิบาย |
|---|---|---|
| project_custom_status | id PK, label, created_by FK→employee.id | สถานะโครงการที่ผู้ใช้ตั้งเพิ่มเอง |
| project_custom_type | id PK, label, created_by FK→employee.id | ประเภทโครงการที่ผู้ใช้ตั้งเพิ่มเอง |

## audit_log — บันทึกกิจกรรม

| คอลัมน์ | ชนิด | Null ได้ | Key | คำอธิบาย |
|---|---|---|---|---|
| id | varchar(30) | ไม่ | PK | — |
| timestamp | datetime | ไม่ | — | เวลาที่เกิดเหตุการณ์ |
| user_name / role / department | varchar | ไม่ | — (ไม่ใช่ FK) | **สำเนา** ข้อมูลผู้ทำรายการ ณ ตอนนั้น — ไม่อัปเดตย้อนหลังแม้พนักงานจะเปลี่ยนชื่อ/ตำแหน่งภายหลัง |
| action | varchar(100) | ไม่ | — | เช่น `ADD_PROJECT`, `LOGIN` |
| details | text | ไม่ | — | คำอธิบายเหตุการณ์แบบอ่านง่าย |

## password_reset_otp — รหัส OTP ลืมรหัสผ่าน

| คอลัมน์ | ชนิด | Null ได้ | Key | คำอธิบาย |
|---|---|---|---|---|
| id | int unsigned, auto_increment | ไม่ | PK | — |
| email | varchar(255) | ไม่ | MUL (ไม่มี FK) | อีเมลที่ขอรีเซ็ต |
| otp_hash | varchar(255) | ไม่ | — | OTP แบบ hash (ไม่เก็บ plaintext) |
| attempts | tinyint unsigned | ไม่ (default 0) | — | จำนวนครั้งที่กรอกผิด |
| verified | tinyint(1) | ไม่ (default 0) | — | ยืนยัน OTP สำเร็จแล้วหรือยัง |
| expires_at | datetime | ไม่ | — | หมดอายุเมื่อไหร่ (10 นาทีหลังขอ) |
