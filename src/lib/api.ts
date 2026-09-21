import { Employee, CredentialItem, Meeting, Notification, NotificationCategory, LinkedDoc } from '../types';
import type { ProjectRow, ProjectTaskItem, CustomProjectStatus } from '../components/projectBoard/types';

// Vite only exposes env vars prefixed VITE_ to client code — set in .env,
// separate from the server-only DB_* vars that server/db.ts reads.
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:4000';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export interface LoginResult {
  id: number;
  username: string;
  employeeId: string | null;
}

export async function loginRequest(username: string, password: string): Promise<LoginResult> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
  } catch {
    throw new ApiError('ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองใหม่อีกครั้ง', 0);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.message ?? 'เข้าสู่ระบบไม่สำเร็จ', res.status);
  }
  return data as LoginResult;
}

async function postAuthAction(path: string, body: Record<string, string>, fallbackMessage: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/auth/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError('ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองใหม่อีกครั้ง', 0);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.message ?? fallbackMessage, res.status);
  }
  return data.message as string;
}

export function requestPasswordResetOtp(email: string): Promise<string> {
  return postAuthAction('forgot-password', { email }, 'ส่งรหัส OTP ไม่สำเร็จ');
}

export function verifyPasswordResetOtp(email: string, otp: string): Promise<string> {
  return postAuthAction('verify-otp', { email, otp }, 'ยืนยันรหัส OTP ไม่สำเร็จ');
}

export function resetPasswordWithOtp(email: string, newPassword: string): Promise<string> {
  return postAuthAction('reset-password', { email, newPassword }, 'เปลี่ยนรหัสผ่านไม่สำเร็จ');
}

export async function fetchEmployees(): Promise<Employee[]> {
  const res = await fetch(`${API_BASE_URL}/api/employees`);
  if (!res.ok) throw new Error(`Failed to fetch employees: ${res.status}`);
  return res.json();
}

export async function createEmployee(employee: Employee & { password: string }): Promise<Employee> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/employees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(employee),
    });
  } catch {
    throw new ApiError('ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองใหม่อีกครั้ง', 0);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.message ?? 'สร้างบัญชีพนักงานไม่สำเร็จ', res.status);
  }
  return data as Employee;
}

// actorEmployeeId lets the server's "admin can't touch admin-like accounts" gate tell a
// self-edit/superadmin/executive apart from a plain admin overreaching — same trust level as
// every other actorEmployeeId check in this app (no real session/auth layer to verify it against).
export async function updateEmployeeRemote(
  id: string,
  updates: Partial<Pick<Employee, 'name' | 'nickname' | 'email' | 'role' | 'avatar' | 'department' | 'division' | 'username' | 'accountType' | 'restrictedMenuIds' | 'phone' | 'address' | 'mutedNotificationCategories'>> & { password?: string },
  actorEmployeeId?: string
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/employees/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...updates, actorEmployeeId }),
    });
  } catch {
    throw new ApiError('ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองใหม่อีกครั้ง', 0);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.message ?? 'บันทึกข้อมูลไม่สำเร็จ', res.status);
  }
}

// Settings → เปลี่ยนรหัสผ่าน — limited to once per day server-side; a 429 surfaces its message as
// an ApiError so the page can show it inline.
export async function changeSelfPassword(id: string, password: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/employees/${encodeURIComponent(id)}/password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actorEmployeeId: id, password }),
    });
  } catch {
    throw new ApiError('ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองใหม่อีกครั้ง', 0);
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(data.message ?? 'เปลี่ยนรหัสผ่านไม่สำเร็จ', res.status);
  }
}

export async function deleteEmployeeRemote(id: string, actorEmployeeId?: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/employees/${encodeURIComponent(id)}?actorEmployeeId=${encodeURIComponent(actorEmployeeId ?? '')}`, { method: 'DELETE' });
  } catch {
    throw new ApiError('ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองใหม่อีกครั้ง', 0);
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(data.message ?? 'ลบบัญชีไม่สำเร็จ', res.status);
  }
}

// Server-side pre-filters to only what actorEmployeeId is allowed to see (personal by creator id,
// team by department, project by project membership — ผู้บริหาร sees every team/project row) —
// mirrors fetchDocuments' own actor-scoped shape. No actorEmployeeId means nobody's logged in yet.
export async function fetchCredentials(actorEmployeeId: string): Promise<CredentialItem[]> {
  const res = await fetch(`${API_BASE_URL}/api/credentials?actorEmployeeId=${encodeURIComponent(actorEmployeeId)}`);
  if (!res.ok) throw new Error(`Failed to fetch credentials: ${res.status}`);
  return res.json();
}

export async function createCredential(item: CredentialItem): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item),
  });
  if (!res.ok) throw new Error(`Failed to create credential: ${res.status}`);
}

export async function updateCredentialRemote(id: string, item: CredentialItem): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/credentials/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item),
  });
  if (!res.ok) throw new Error(`Failed to update credential: ${res.status}`);
}

export async function deleteCredentialRemote(id: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/credentials/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Failed to delete credential: ${res.status}`);
}

export async function fetchProjects(): Promise<ProjectRow[]> {
  const res = await fetch(`${API_BASE_URL}/api/projects`);
  if (!res.ok) throw new Error(`Failed to fetch projects: ${res.status}`);
  return res.json();
}

export type CreateProjectPayload = Partial<
  Pick<ProjectRow, 'id' | 'title' | 'description' | 'department' | 'type' | 'abbreviation' | 'priority' | 'budget' | 'ownerEmployeeIds' | 'memberEmployeeIds' | 'memberDuties' | 'docFolderId' | 'progress' | 'status'>
> & { title: string; startDate?: string | null; endDate?: string | null; createdBy?: string | null };

export async function createProject(payload: CreateProjectPayload): Promise<ProjectRow> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new ApiError('ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองใหม่อีกครั้ง', 0);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.message ?? 'สร้างโครงการไม่สำเร็จ', res.status);
  }
  return data as ProjectRow;
}

// actorEmployeeId lets the server's ownership gate tell "an owner editing" apart from "someone
// else editing" once the project has ≥1 owner — see server/routes/projects.ts. A 409 here means
// the caller isn't an owner and must go through createChangeRequest instead.
export async function updateProjectRemote(id: string, updates: Partial<ProjectRow>, actorEmployeeId: string): Promise<ProjectRow> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/projects/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...updates, actorEmployeeId }),
    });
  } catch {
    throw new ApiError('ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองใหม่อีกครั้ง', 0);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.message ?? 'บันทึกข้อมูลโครงการไม่สำเร็จ', res.status);
  }
  return data as ProjectRow;
}

export async function deleteProjectRemote(id: string, actorEmployeeId: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/projects/${encodeURIComponent(id)}?actorEmployeeId=${encodeURIComponent(actorEmployeeId)}`, { method: 'DELETE' });
  } catch {
    throw new ApiError('ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองใหม่อีกครั้ง', 0);
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(data.message ?? 'ลบโครงการไม่สำเร็จ', res.status);
  }
}

export async function fetchProjectCustomStatuses(): Promise<CustomProjectStatus[]> {
  const res = await fetch(`${API_BASE_URL}/api/project-custom-statuses`);
  if (!res.ok) throw new Error(`Failed to fetch project custom statuses: ${res.status}`);
  return res.json();
}

export async function createProjectCustomStatus(label: string, createdBy?: string | null): Promise<CustomProjectStatus> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/project-custom-statuses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label, createdBy }),
    });
  } catch {
    throw new ApiError('ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองใหม่อีกครั้ง', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.message ?? 'สร้างสถานะไม่สำเร็จ', res.status);
  }
  return data as CustomProjectStatus;
}

export async function deleteProjectCustomStatusRemote(id: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/project-custom-statuses/${encodeURIComponent(id)}`, { method: 'DELETE' });
  } catch {
    throw new ApiError('ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองใหม่อีกครั้ง', 0);
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(data.message ?? 'ลบสถานะไม่สำเร็จ', res.status);
  }
}

export async function fetchMeetings(): Promise<Meeting[]> {
  const res = await fetch(`${API_BASE_URL}/api/meetings`);
  if (!res.ok) throw new Error(`Failed to fetch meetings: ${res.status}`);
  return res.json();
}

export async function createMeeting(meeting: Omit<Meeting, 'id'>): Promise<Meeting> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/meetings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(meeting),
    });
  } catch {
    throw new ApiError('ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองใหม่อีกครั้ง', 0);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.message ?? 'นัดประชุมไม่สำเร็จ', res.status);
  }
  return data as Meeting;
}

export async function updateMeetingRemote(id: string, updates: Partial<Meeting>): Promise<Meeting> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/meetings/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
  } catch {
    throw new ApiError('ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองใหม่อีกครั้ง', 0);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.message ?? 'บันทึกข้อมูลการประชุมไม่สำเร็จ', res.status);
  }
  return data as Meeting;
}

export async function fetchProjectTasks(): Promise<ProjectTaskItem[]> {
  const res = await fetch(`${API_BASE_URL}/api/project-tasks`);
  if (!res.ok) throw new Error(`Failed to fetch project tasks: ${res.status}`);
  return res.json();
}

export async function createProjectTask(task: Omit<ProjectTaskItem, 'id'>): Promise<ProjectTaskItem> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/project-tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(task),
    });
  } catch {
    throw new ApiError('ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองใหม่อีกครั้ง', 0);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.message ?? 'เพิ่มงานไม่สำเร็จ', res.status);
  }
  return data as ProjectTaskItem;
}

// actorEmployeeId lets the server's ownership gate tell "an assignee editing" apart from "someone
// else editing" once the task has ≥1 assignee — see server/routes/project-tasks.ts. A 409 here
// means the caller isn't an assignee and must go through createChangeRequest instead.
export async function updateProjectTaskRemote(id: string, updates: Partial<ProjectTaskItem>, actorEmployeeId: string): Promise<ProjectTaskItem> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/project-tasks/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...updates, actorEmployeeId }),
    });
  } catch {
    throw new ApiError('ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองใหม่อีกครั้ง', 0);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.message ?? 'บันทึกข้อมูลงานไม่สำเร็จ', res.status);
  }
  return data as ProjectTaskItem;
}

export async function deleteProjectTaskRemote(id: string, actorEmployeeId: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/project-tasks/${encodeURIComponent(id)}?actorEmployeeId=${encodeURIComponent(actorEmployeeId)}`, { method: 'DELETE' });
  } catch {
    throw new ApiError('ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองใหม่อีกครั้ง', 0);
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(data.message ?? 'ลบงานไม่สำเร็จ', res.status);
  }
}

// Server-side pre-filters to only what `actorEmployeeId` is allowed to see (personal docs by
// creator, project docs by project ownership/membership) — see server/routes/documents.ts. No
// actorEmployeeId means nobody's logged in yet, so the server returns an empty list.
export async function fetchDocuments(actorEmployeeId: string): Promise<LinkedDoc[]> {
  const res = await fetch(`${API_BASE_URL}/api/documents?actorEmployeeId=${encodeURIComponent(actorEmployeeId)}`);
  if (!res.ok) throw new Error(`Failed to fetch documents: ${res.status}`);
  return res.json();
}

export async function createDocument(doc: Omit<LinkedDoc, 'id'>): Promise<LinkedDoc> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(doc),
    });
  } catch {
    throw new ApiError('ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองใหม่อีกครั้ง', 0);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.message ?? 'บันทึกเอกสารไม่สำเร็จ', res.status);
  }
  return data as LinkedDoc;
}

export async function updateDocumentRemote(id: string, updates: Partial<LinkedDoc>): Promise<LinkedDoc> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/documents/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
  } catch {
    throw new ApiError('ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองใหม่อีกครั้ง', 0);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.message ?? 'บันทึกเอกสารไม่สำเร็จ', res.status);
  }
  return data as LinkedDoc;
}

export async function deleteDocumentRemote(id: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/documents/${encodeURIComponent(id)}`, { method: 'DELETE' });
  } catch {
    throw new ApiError('ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองใหม่อีกครั้ง', 0);
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(data.message ?? 'ลบเอกสารไม่สำเร็จ', res.status);
  }
}

export async function fetchNotifications(employeeId: string): Promise<Notification[]> {
  const res = await fetch(`${API_BASE_URL}/api/notifications?employeeId=${encodeURIComponent(employeeId)}`);
  if (!res.ok) throw new Error(`Failed to fetch notifications: ${res.status}`);
  return res.json();
}

export interface CreateNotificationPayload {
  id?: string; // deterministic id for the due-soon/overdue/meeting-soon periodic checks — see notifications.ts
  targetEmployeeId: string;
  title: string;
  message: string;
  type?: Notification['type'];
  // Which Settings → การแจ้งเตือน switch controls this one. Omitted = never filtered (legacy handover).
  category?: NotificationCategory;
  linkType?: Notification['linkType'];
  linkId?: string;
}

export async function createNotification(payload: CreateNotificationPayload): Promise<Notification> {
  const res = await fetch(`${API_BASE_URL}/api/notifications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to create notification: ${res.status}`);
  return res.json();
}

export async function markNotificationRead(id: string): Promise<void> {
  await fetch(`${API_BASE_URL}/api/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' });
}

export async function markAllNotificationsRead(employeeId: string): Promise<void> {
  await fetch(`${API_BASE_URL}/api/notifications/mark-all-read`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ employeeId }),
  });
}

// Filed whenever someone who isn't one of a project's/task's current owners tries to edit or
// delete it — see server/routes/change-requests.ts. Any one of the entity's owners approving is
// enough (equal authority, first-decision-wins), same as the existing task-reviewer pattern.
export interface ChangeRequest {
  id: string;
  entityType: 'project' | 'project_task' | 'employee';
  entityId: string;
  requestType: 'edit' | 'delete';
  proposedChanges?: Record<string, unknown>;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedBy?: string;
  requestedAt: string;
  decidedBy?: string;
  decidedAt?: string;
  decisionNote?: string;
}

export async function fetchChangeRequests(filter?: { entityType: 'project' | 'project_task' | 'employee'; entityId: string }): Promise<ChangeRequest[]> {
  const query = filter ? `?entityType=${encodeURIComponent(filter.entityType)}&entityId=${encodeURIComponent(filter.entityId)}` : '';
  const res = await fetch(`${API_BASE_URL}/api/change-requests${query}`);
  if (!res.ok) throw new Error(`Failed to fetch change requests: ${res.status}`);
  return res.json();
}

export async function createChangeRequest(payload: {
  entityType: 'project' | 'project_task' | 'employee';
  entityId: string;
  requestType: 'edit' | 'delete';
  proposedChanges?: Record<string, unknown>;
  reason: string;
  requestedBy: string;
}): Promise<ChangeRequest> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/change-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new ApiError('ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองใหม่อีกครั้ง', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.message ?? 'ส่งคำขอไม่สำเร็จ', res.status);
  }
  return data as ChangeRequest;
}

export async function decideChangeRequest(
  id: string,
  decision: 'approve' | 'reject',
  decidedBy: string,
  note?: string
): Promise<ChangeRequest> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/change-requests/${encodeURIComponent(id)}/decide`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, decidedBy, note }),
    });
  } catch {
    throw new ApiError('ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองใหม่อีกครั้ง', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.message ?? 'บันทึกผลการพิจารณาไม่สำเร็จ', res.status);
  }
  return data as ChangeRequest;
}
