// The company's real org-chart divisions (โครงสร้างองค์กร) and, within each, its real sections —
// admin-editable from the Employee Management > โครงสร้างองค์กร tab (see AppDataContext's
// `orgDivisions` state and src/data/orgStructure.ts for the seed data and placement helpers).
// Every `department`/`team` field below (Employee, Task, LinkedDoc, CredentialItem, AuditLog)
// holds one of those real section names now — the old generic IT/HR/Marketing/... placeholder
// categories have been retired entirely since the company hadn't settled on abbreviations for them.
// A plain string, not a fixed union, since the set of valid names can change at runtime.
export type Division = string;

// 4-level account type — see src/lib/permissions.ts for exactly what each can do. Replaced the
// old boolean `isAdmin` because a boolean can't express "admin can't edit another admin's
// account but superadmin can" or "executive sees everything but can't manage employees."
export const ACCOUNT_TYPES = ['employee', 'admin', 'superadmin', 'executive'] as const;
export type AccountType = typeof ACCOUNT_TYPES[number];

export interface Employee {
  id: string;
  name: string; // Legal name — editable only by an admin, never by the account itself
  nickname?: string; // Self-editable by the account itself; defaults to `name` until changed
  email: string; // Contact info only — login now uses `username`, not this
  username?: string; // Login credential, joined in from the `login` table
  phone?: string;
  address?: string;
  role: string;
  department: string; // Real org-chart section (แผนก) — cascades from `division` below
  division?: Division; // Placement in the company org chart (โครงสร้างองค์กร)
  avatar: string;
  accountType: AccountType; // Gates which pages/menus this account can reach — see permissions.ts
  // Per-account Sidebar menu blocklist (nav item ids, see Sidebar.tsx's NAV_ITEMS), layered on
  // top of `accountType`'s own default access — lets an admin deny one specific person a menu
  // their role would otherwise allow.
  restrictedMenuIds?: string[];
  createdAt?: string; // When the account row was created (server-assigned) — shown as "เข้าร่วมเมื่อ"
}

export type Priority = 'Low' | 'Medium' | 'High';
export type TaskStatus = 'Not Started' | 'In Progress' | 'Completed' | 'On Hold';

export interface Task {
  id: string;
  title: string;
  description: string;
  project: string;
  priority: Priority;
  status: TaskStatus;
  progress: number; // 0 to 100
  startDate: string;
  dueDate: string;
  actualEndDate?: string;
  department: string; // Real org-chart section (แผนก)
  primaryOwnerId: string; // Primary responsible person
  secondaryAssigneeIds: string[]; // Secondary assignees
  contributorIds: string[]; // Contributors
  dependencies: string[]; // Task IDs that must be completed first
  approvalStatus: 'None' | 'Pending Approval' | 'Approved' | 'Rejected';
  approvalNote?: string;
  linkedDocIds: string[]; // Document IDs linked to this task
  handovers: HandoverRecord[];
}

export interface HandoverRecord {
  id: string;
  fromUserId: string;
  toUserId: string;
  stageName: string;
  notes: string;
  timestamp: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  approvedBy?: string;
  approvalNotes?: string;
}

export interface LinkedDoc {
  id: string;
  name: string;
  kind: 'folder' | 'file' | 'link';
  // Parent folder's id, or null for items sitting at the Drive root — forms the folder tree.
  parentId: string | null;
  url?: string; // kind === 'link'
  fileDataUrl?: string; // kind === 'file' — base64 data: URL, read via FileReader on upload
  fileMimeType?: string; // kind === 'file'
  fileSize?: number; // kind === 'file' — bytes
  // 'ส่วนตัว' is visible only to its own creator; 'โครงการ' is visible only to that project's
  // current owners/members ("คนที่รับผิดชอบโครงการนั้น") — enforced server-side, see
  // server/routes/documents.ts. Required for real access control, not just a display tag.
  scope: 'ส่วนตัว' | 'โครงการ';
  projectId?: string; // required when scope === 'โครงการ' — id of the real ProjectRow this item belongs to
  creatorEmployeeId?: string; // who created this item — drives 'ส่วนตัว' visibility, unlike `updatedBy` (a display name)
  // Set only on a folder created via a project task's own "create folder" checkbox (see
  // AddTaskModal.tsx) — lets DocVault show which task (and, via the task's own projectId, which
  // project) owns this folder. Anything nested inside it inherits the tag by walking up parentId,
  // so an untagged file dropped inside still resolves to the right project/task.
  taskId?: string;
  version: number;
  lastUpdated: string;
  updatedBy: string;
  history: DocHistory[];
}

export interface DocHistory {
  version: number;
  updatedBy: string;
  date: string;
  note: string;
}

export interface CredentialItem {
  id: string;
  label: string;
  type: 'Username & Password' | 'API Key' | 'Bank Account' | 'Access Token';
  scope: 'ส่วนตัว' | 'ทีม' | 'โครงการ';
  team?: string; // Matches the creator's `Employee.department` (real org-chart section) at creation time
  projectId?: string; // set when scope === 'โครงการ' — visible to that project's owners/members
  username: string;
  password?: string;
  keyValue?: string;
  notes?: string;
  url?: string;
  logoUrl?: string;
  lastViewedAt?: string;
  createdAt: string;
  createdBy: string; // display name — kept for legacy rows created before creatorEmployeeId existed
  creatorEmployeeId?: string; // real id — server-side visibility filtering keys off this, not createdBy
}

export interface AuditLog {
  id: string;
  timestamp: string;
  user: string;
  role: string; // ตำแหน่งของผู้ทำรายการ ณ เวลาที่บันทึก log
  department: string; // แผนกของผู้ทำรายการ ณ เวลาที่บันทึก log ('' เมื่อไม่ทราบ)
  action: string; // e.g. "VIEW_CREDENTIAL", "CREATE_TASK"
  details: string;
}

// A scheduled meeting — optionally tied to a project (from the "จัดการงานและโครงการ" module's
// "เพิ่มงาน" modal's new "การประชุม" tab), but not required to be, so it can also work as a
// standalone/company-wide meeting shown only on the calendar. Kept as a real AppDataContext/
// localStorage-backed domain type rather than local component state,
// so a meeting created from a project's page and one shown on the Calendar page are the same
// record — see CalendarView.tsx and projectBoard/ProjectDetail.tsx, both of which read this type.
export interface Meeting {
  id: string;
  projectId?: string;
  department?: string; // แผนกที่จัดประชุม (ไม่บังคับ) — ใช้ช่วยกรองผู้เข้าร่วมและเป็น tag บนปฏิทิน
  title: string;
  description?: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime?: string; // HH:mm
  attendeeIds: string[]; // Employee ids
  location?: string; // a physical place — a meeting can have this AND meetingLink at once (e.g.
  // an in-room meeting that also opens an online bridge for remote attendees), so the two are
  // separate fields rather than one dual-purpose one. Pre-existing meetings from before this
  // split may still hold a URL in here (no backfill was run) — display code should still detect
  // and link-ify that case for them.
  meetingLink?: string; // an online meeting URL (Zoom/Meet/Teams/etc.)
  locationLink?: string; // a map link (e.g. Google Maps) for `location`, for meetings held outside the office
  createdBy?: string; // Employee id
  status: 'scheduled' | 'cancelled';
  cancellationReason?: string; // required whenever status is 'cancelled' — see ScheduleMeetingModal's cancel flow
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  type: 'info' | 'success' | 'warning';
  // Deep-link target for clicking the notification in Header's bell dropdown. Every current
  // trigger (task assignment/review, meeting scheduled/cancelled) is always viewed by opening its
  // parent project's detail page — there's no standalone task or meeting view — so linkId is
  // always a project id and 'project' is the only linkType there is today.
  linkType?: 'project';
  linkId?: string;
}
