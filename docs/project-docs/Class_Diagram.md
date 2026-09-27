# Class Diagram

ระบบนี้เป็นเว็บแอป React (function components + hooks) ไม่ใช่ระบบเชิงวัตถุ (OOP) แบบมี class จริงๆ "class diagram" ในที่นี้จึงหมายถึง **โครงสร้างข้อมูล (data model) ฝั่งโค้ด TypeScript** ที่ใช้ร่วมกันทั้งแอป (`src/types.ts` และ `src/components/projectBoard/types.ts`) ซึ่งเป็นรูปร่างข้อมูลหลังผ่านการแปลงจากฐานข้อมูลแล้ว (camelCase, วันที่จัดรูปแบบไทยพร้อมกับค่า ISO ดิบ) ไม่ใช่คอลัมน์ฐานข้อมูลตรงๆ — เทียบกับโครงสร้างฐานข้อมูลจริงได้ที่ [ER_Diagram.md](./ER_Diagram.md)

```mermaid
classDiagram
    class Employee {
        +string id
        +string name
        +string nickname?
        +string email?
        +string username?
        +string role
        +string department
        +string division?
        +AccountType accountType
        +string[] restrictedMenuIds?
        +NotificationCategory[] mutedNotificationCategories?
    }

    class ProjectRow {
        +string id
        +string code
        +string title
        +ProjectType type?
        +string abbreviation?
        +ProjectPriority priority?
        +number budget?
        +string[] ownerEmployeeIds
        +string[] memberEmployeeIds
        +Record~string,string~ memberDuties?
        +string docFolderId?
        +number progress
        +string startDateISO?
        +string endDateISO?
        +number daysUntilDue?
        +ProjectStatus status
        +string createdByEmployeeId?
        +string parentProjectId?
    }

    class ProjectTaskItem {
        +string id
        +string projectId
        +string title
        +ProjectTaskStatus status
        +ProjectPriority priority?
        +string[] assigneeEmployeeIds
        +string[] reviewerEmployeeIds
        +string creatorEmployeeId?
        +string startDateISO?
        +string dueDateISO?
        +number progress
        +ProjectTaskChecklistItem[] checklist
        +string submissionNote?
        +string[] submissionFileIds?
        +string reviewNote?
        +string blockedReason?
        +string parentTaskId?
    }

    class Meeting {
        +string id
        +string projectId?
        +string taskId?
        +string title
        +string date
        +string startTime
        +string endTime?
        +string[] attendeeIds
        +string location?
        +string meetingLink?
        +string createdBy?
        +MeetingStatus status
        +string cancellationReason?
    }

    class LinkedDoc {
        +string id
        +string name
        +DocKind kind
        +string parentId?
        +string url?
        +string fileDataUrl?
        +DocScope scope
        +string projectId?
        +string creatorEmployeeId?
        +string taskId?
        +number version
        +DocHistory[] history
    }

    class CredentialItem {
        +string id
        +string label
        +CredentialType type
        +CredentialScope scope
        +string team?
        +string projectId?
        +string username
        +string password?
        +string keyValue?
        +string creatorEmployeeId?
    }

    class ChangeRequest {
        +string id
        +EntityType entityType
        +string entityId
        +RequestType requestType
        +object proposedChanges?
        +string reason
        +ChangeRequestStatus status
        +string requestedBy?
        +string decidedBy?
        +string decisionNote?
    }

    class Notification {
        +string id
        +string title
        +string message
        +string timestamp
        +boolean read
        +NotifyType type
        +NotificationCategory category?
        +string linkType?
        +string linkId?
    }

    class AuditLog {
        +string id
        +string timestamp
        +string user
        +string role
        +string department
        +string action
        +string details
    }

    Employee "1" --> "0..*" ProjectRow : สร้าง/ดูแล/เป็นสมาชิก
    Employee "0..*" -- "0..*" ProjectTaskItem : รับผิดชอบ/ตรวจ
    ProjectRow "1" --> "0..*" ProjectTaskItem : มีงาน
    ProjectRow "1" --> "0..*" Meeting : มีนัดประชุม
    ProjectRow "1" --> "0..*" LinkedDoc : มีเอกสาร
    ProjectTaskItem "0..1" --> "0..*" Meeting : ผูกกับงาน
    ProjectTaskItem "1" --> "0..*" ProjectTaskItem : งานย่อย
    ProjectRow "1" --> "0..*" ProjectRow : โครงการย่อย
    Employee "1" --> "0..*" LinkedDoc : สร้างเอกสาร
    Employee "1" --> "0..*" CredentialItem : เก็บรหัสผ่าน
    Employee "1" --> "0..*" ChangeRequest : ยื่น/ตัดสิน
    Employee "1" --> "0..*" Notification : ได้รับ
    Employee "1" --> "0..*" AuditLog : ก่อเหตุการณ์
```

## หมายเหตุประกอบ

- **ProjectRow / ProjectTaskItem มีทั้งฟิลด์วันที่แบบไทย (`startDate`) และแบบ ISO ดิบ (`startDateISO`)** — ฟิลด์ไทยใช้แสดงผลอย่างเดียว ฟิลด์ ISO ใช้ป้อนกลับเข้า `<input type="date">` ตอนแก้ไข ห้ามสลับใช้ผิดที่
- **`daysUntilDue` เป็นค่าคำนวณสด ไม่ถูกเก็บในฐานข้อมูล** คำนวณใหม่ทุกครั้งที่อ่านจากเซิร์ฟเวอร์ (นับแบบเวลาไทย ไม่ใช่ UTC)
- **`ProjectTaskItem.status` มีส่วนที่คำนวณอัตโนมัติ** งานที่มีงานย่อย จะไม่รับค่าสถานะที่ตั้งเอง แต่คำนวณจากงานย่อยเสมอ (ดู `recomputeAncestorStatuses` ฝั่งเซิร์ฟเวอร์)
- **`Employee.accountType`** เป็น enum 4 ค่า (`employee | admin | superadmin | executive`) ตัดสินสิทธิ์ทั้งหมดของระบบ — ดูรายละเอียดที่ [SRS.md](./SRS.md) หมวด non-functional/functional requirements ด้านความปลอดภัย
- Type ทั้งหมดประกาศจริงอยู่ที่ `src/types.ts` (Employee, LinkedDoc, CredentialItem, AuditLog, Meeting, Notification) และ `src/components/projectBoard/types.ts` (ProjectRow, ProjectTaskItem, CustomProjectStatus, CustomProjectType)
