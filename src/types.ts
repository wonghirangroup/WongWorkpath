export type Department = 'IT' | 'HR' | 'Marketing' | 'Sales' | 'Design' | 'Finance';

export interface Employee {
  id: string;
  name: string; // Legal name — editable only by an admin, never by the account itself
  nickname?: string; // Self-editable by the account itself; defaults to `name` until changed
  email: string; // Contact info only — login now uses `username`, not this
  username?: string; // Login credential, joined in from the `login` table
  role: string;
  department: Department;
  avatar: string;
  isAdmin?: boolean; // Gates access to the Employee Management page
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
  department: Department;
  primaryOwnerId: string; // Primary responsible person
  secondaryAssigneeIds: string[]; // Secondary assignees
  contributorIds: string[]; // Contributors
  dependencies: string[]; // Task IDs that must be completed first
  approvalStatus: 'None' | 'Pending Approval' | 'Approved' | 'Rejected';
  approvalNote?: string;
  recurringPattern: 'None' | 'Weekly' | 'Monthly';
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
  scope: 'ส่วนตัว' | 'ทีม';
  team?: Department; // scope === 'ทีม'
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
  scope: 'ส่วนตัว' | 'ทีม';
  team?: Department;
  username: string;
  password?: string;
  keyValue?: string;
  notes?: string;
  url?: string;
  logoUrl?: string;
  lastViewedAt?: string;
  createdAt: string;
  createdBy: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  user: string;
  role: string; // ตำแหน่งของผู้ทำรายการ ณ เวลาที่บันทึก log
  action: string; // e.g. "VIEW_CREDENTIAL", "CREATE_TASK"
  details: string;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  type: 'Vacation' | 'Sick Leave' | 'Personal Leave' | 'Business Leave';
  startDate: string;
  endDate: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  notes: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  type: 'info' | 'success' | 'warning';
}
