import { Employee, CredentialItem, Meeting, Notification, NotificationCategory, LinkedDoc, AuditLog } from '../types';
import type { ProjectRow, ProjectTaskItem, CustomProjectStatus, CustomProjectType } from '../components/projectBoard/types';
import type { OrgDivisionData } from '../data/orgStructure';

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

// --- Session token -------------------------------------------------------------------------
// /api/auth/login hands back a signed token; every other endpoint requires it as a Bearer header.
// It lives in localStorage (the API is on a different site from the page, so a cookie wouldn't be
// sent reliably) and is dropped the moment the server says it's no longer valid.
const AUTH_TOKEN_KEY = 'unityspace_auth_token';

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string): void {
  try {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  } catch {
    /* storage blocked — the session simply won't survive a reload */
  }
}

export function clearAuthToken(): void {
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {
    /* nothing to clear */
  }
}

// AppDataContext registers this so an expired/revoked session drops the user back to the login page
// from anywhere, instead of every screen showing its own confusing "failed to load" error.
let onSessionExpired: (() => void) | null = null;
export function setSessionExpiredHandler(handler: (() => void) | null): void {
  onSessionExpired = handler;
}

// Drop-in replacement for fetch() that attaches the session token and reacts to a 401.
async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = getAuthToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(input, { ...init, headers });
  if (res.status === 401 && token) {
    clearAuthToken();
    onSessionExpired?.();
  }
  return res;
}

export interface LoginResult {
  id: number;
  username: string;
  employeeId: string;
  token: string;
  employee: Employee;
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
  // A server that doesn't hand back a token + employee is an older build still mid-deploy — say so
  // instead of storing "undefined" and crashing on the missing employee.
  if (typeof data.token !== 'string' || !data.employee) {
    throw new ApiError('ระบบกำลังอัปเดต กรุณารอสักครู่แล้วลองเข้าสู่ระบบอีกครั้ง', 503);
  }
  setAuthToken(data.token);
  return data as LoginResult;
}

// Validates the stored token and returns the employee it belongs to — used to restore a session
// after a page reload. Throws ApiError with status 401 when the token is missing/expired.
export async function fetchCurrentUser(): Promise<Employee> {
  let res: Response;
  try {
    res = await authFetch(`${API_BASE_URL}/api/auth/me`);
  } catch {
    throw new ApiError('ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองใหม่อีกครั้ง', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.message ?? 'เข้าสู่ระบบไม่สำเร็จ', res.status);
  return data as Employee;
}

async function postAuthAction<T extends { message: string }>(path: string, body: Record<string, string>, fallbackMessage: string): Promise<T> {
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
  return data as T;
}

export async function requestPasswordResetOtp(email: string): Promise<string> {
  return (await postAuthAction('forgot-password', { email }, 'ส่งรหัส OTP ไม่สำเร็จ')).message;
}

// Returns the resetToken to hand to resetPasswordWithOtp — proof that this browser entered the OTP.
export async function verifyPasswordResetOtp(email: string, otp: string): Promise<string> {
  const data = await postAuthAction<{ message: string; resetToken: string }>('verify-otp', { email, otp }, 'ยืนยันรหัส OTP ไม่สำเร็จ');
  return data.resetToken;
}

export async function resetPasswordWithOtp(email: string, newPassword: string, resetToken: string): Promise<string> {
  return (await postAuthAction('reset-password', { email, newPassword, resetToken }, 'เปลี่ยนรหัสผ่านไม่สำเร็จ')).message;
}

export async function fetchEmployees(): Promise<Employee[]> {
  const res = await authFetch(`${API_BASE_URL}/api/employees`);
  if (!res.ok) throw new Error(`Failed to fetch employees: ${res.status}`);
  return res.json();
}

export async function createEmployee(employee: Employee & { password: string }): Promise<Employee> {
  let res: Response;
  try {
    res = await authFetch(`${API_BASE_URL}/api/employees`, {
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

// The server takes the acting employee from the session token, not from actorEmployeeId (it
// overwrites whatever is sent) — the argument is kept only so existing call sites stay unchanged.
export async function updateEmployeeRemote(
  id: string,
  updates: Partial<Pick<Employee, 'name' | 'nickname' | 'email' | 'role' | 'avatar' | 'department' | 'division' | 'username' | 'accountType' | 'restrictedMenuIds' | 'phone' | 'address' | 'mutedNotificationCategories'>> & { password?: string },
  actorEmployeeId?: string
): Promise<void> {
  let res: Response;
  try {
    res = await authFetch(`${API_BASE_URL}/api/employees/${encodeURIComponent(id)}`, {
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
    res = await authFetch(`${API_BASE_URL}/api/employees/${encodeURIComponent(id)}/password`, {
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
    res = await authFetch(`${API_BASE_URL}/api/employees/${encodeURIComponent(id)}?actorEmployeeId=${encodeURIComponent(actorEmployeeId ?? '')}`, { method: 'DELETE' });
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
  const res = await authFetch(`${API_BASE_URL}/api/credentials?actorEmployeeId=${encodeURIComponent(actorEmployeeId)}`);
  if (!res.ok) throw new Error(`Failed to fetch credentials: ${res.status}`);
  return res.json();
}

export async function createCredential(item: CredentialItem): Promise<void> {
  const res = await authFetch(`${API_BASE_URL}/api/credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item),
  });
  if (!res.ok) throw new Error(`Failed to create credential: ${res.status}`);
}

export async function updateCredentialRemote(id: string, item: CredentialItem): Promise<void> {
  const res = await authFetch(`${API_BASE_URL}/api/credentials/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item),
  });
  if (!res.ok) throw new Error(`Failed to update credential: ${res.status}`);
}

export async function deleteCredentialRemote(id: string): Promise<void> {
  const res = await authFetch(`${API_BASE_URL}/api/credentials/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Failed to delete credential: ${res.status}`);
}

export async function fetchProjects(): Promise<ProjectRow[]> {
  const res = await authFetch(`${API_BASE_URL}/api/projects`);
  if (!res.ok) throw new Error(`Failed to fetch projects: ${res.status}`);
  return res.json();
}

export type CreateProjectPayload = Partial<
  Pick<ProjectRow, 'id' | 'title' | 'description' | 'department' | 'type' | 'abbreviation' | 'priority' | 'budget' | 'ownerEmployeeIds' | 'memberEmployeeIds' | 'memberDuties' | 'docFolderId' | 'progress' | 'status' | 'parentProjectId'>
> & { title: string; startDate?: string | null; endDate?: string | null; createdBy?: string | null };

export async function createProject(payload: CreateProjectPayload): Promise<ProjectRow> {
  let res: Response;
  try {
    res = await authFetch(`${API_BASE_URL}/api/projects`, {
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
    res = await authFetch(`${API_BASE_URL}/api/projects/${encodeURIComponent(id)}`, {
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
    res = await authFetch(`${API_BASE_URL}/api/projects/${encodeURIComponent(id)}?actorEmployeeId=${encodeURIComponent(actorEmployeeId)}`, { method: 'DELETE' });
  } catch {
    throw new ApiError('ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองใหม่อีกครั้ง', 0);
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(data.message ?? 'ลบโครงการไม่สำเร็จ', res.status);
  }
}

export async function fetchProjectCustomStatuses(): Promise<CustomProjectStatus[]> {
  const res = await authFetch(`${API_BASE_URL}/api/project-custom-statuses`);
  if (!res.ok) throw new Error(`Failed to fetch project custom statuses: ${res.status}`);
  return res.json();
}

export async function createProjectCustomStatus(label: string, createdBy?: string | null): Promise<CustomProjectStatus> {
  let res: Response;
  try {
    res = await authFetch(`${API_BASE_URL}/api/project-custom-statuses`, {
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
    res = await authFetch(`${API_BASE_URL}/api/project-custom-statuses/${encodeURIComponent(id)}`, { method: 'DELETE' });
  } catch {
    throw new ApiError('ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองใหม่อีกครั้ง', 0);
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(data.message ?? 'ลบสถานะไม่สำเร็จ', res.status);
  }
}

export async function fetchProjectCustomTypes(): Promise<CustomProjectType[]> {
  const res = await authFetch(`${API_BASE_URL}/api/project-custom-types`);
  if (!res.ok) throw new Error(`Failed to fetch project custom types: ${res.status}`);
  return res.json();
}

// `abbreviation` becomes the created type's `id` — see server/routes/project-custom-types.ts.
export async function createProjectCustomType(label: string, abbreviation: string, createdBy?: string | null): Promise<CustomProjectType> {
  let res: Response;
  try {
    res = await authFetch(`${API_BASE_URL}/api/project-custom-types`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label, abbreviation, createdBy }),
    });
  } catch {
    throw new ApiError('ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองใหม่อีกครั้ง', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.message ?? 'สร้างประเภทโครงการไม่สำเร็จ', res.status);
  }
  return data as CustomProjectType;
}

export async function fetchMeetings(): Promise<Meeting[]> {
  const res = await authFetch(`${API_BASE_URL}/api/meetings`);
  if (!res.ok) throw new Error(`Failed to fetch meetings: ${res.status}`);
  return res.json();
}

export async function createMeeting(meeting: Omit<Meeting, 'id'>): Promise<Meeting> {
  let res: Response;
  try {
    res = await authFetch(`${API_BASE_URL}/api/meetings`, {
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
    res = await authFetch(`${API_BASE_URL}/api/meetings/${encodeURIComponent(id)}`, {
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
  const res = await authFetch(`${API_BASE_URL}/api/project-tasks`);
  if (!res.ok) throw new Error(`Failed to fetch project tasks: ${res.status}`);
  return res.json();
}

export async function createProjectTask(task: Omit<ProjectTaskItem, 'id'>): Promise<ProjectTaskItem> {
  let res: Response;
  try {
    res = await authFetch(`${API_BASE_URL}/api/project-tasks`, {
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
    res = await authFetch(`${API_BASE_URL}/api/project-tasks/${encodeURIComponent(id)}`, {
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
    res = await authFetch(`${API_BASE_URL}/api/project-tasks/${encodeURIComponent(id)}?actorEmployeeId=${encodeURIComponent(actorEmployeeId)}`, { method: 'DELETE' });
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
  const res = await authFetch(`${API_BASE_URL}/api/documents?actorEmployeeId=${encodeURIComponent(actorEmployeeId)}`);
  if (!res.ok) throw new Error(`Failed to fetch documents: ${res.status}`);
  return res.json();
}

export async function createDocument(doc: Omit<LinkedDoc, 'id'>): Promise<LinkedDoc> {
  let res: Response;
  try {
    res = await authFetch(`${API_BASE_URL}/api/documents`, {
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
    res = await authFetch(`${API_BASE_URL}/api/documents/${encodeURIComponent(id)}`, {
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
    res = await authFetch(`${API_BASE_URL}/api/documents/${encodeURIComponent(id)}`, { method: 'DELETE' });
  } catch {
    throw new ApiError('ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองใหม่อีกครั้ง', 0);
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(data.message ?? 'ลบเอกสารไม่สำเร็จ', res.status);
  }
}

export async function fetchNotifications(employeeId: string): Promise<Notification[]> {
  const res = await authFetch(`${API_BASE_URL}/api/notifications?employeeId=${encodeURIComponent(employeeId)}`);
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
  const res = await authFetch(`${API_BASE_URL}/api/notifications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to create notification: ${res.status}`);
  return res.json();
}

export async function markNotificationRead(id: string): Promise<void> {
  await authFetch(`${API_BASE_URL}/api/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' });
}

export async function markAllNotificationsRead(employeeId: string): Promise<void> {
  await authFetch(`${API_BASE_URL}/api/notifications/mark-all-read`, {
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
  const res = await authFetch(`${API_BASE_URL}/api/change-requests${query}`);
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
    res = await authFetch(`${API_BASE_URL}/api/change-requests`, {
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
    res = await authFetch(`${API_BASE_URL}/api/change-requests/${encodeURIComponent(id)}/decide`, {
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

// โครงสร้างองค์กร (ฝ่าย/แผนก) — server/routes/org-structure.ts. Name-based, not id-based, matching
// how the rest of the app already treats division/department as identity. Every mutation returns
// the full, freshly-reloaded list so the caller can just setOrgDivisions(result) directly instead
// of re-deriving the update locally.
export async function fetchOrgStructure(): Promise<OrgDivisionData[]> {
  const res = await authFetch(`${API_BASE_URL}/api/org-structure`);
  if (!res.ok) throw new Error(`Failed to fetch org structure: ${res.status}`);
  return res.json();
}

export async function addOrgDivision(name: string, actorEmployeeId: string): Promise<OrgDivisionData[]> {
  let res: Response;
  try {
    res = await authFetch(`${API_BASE_URL}/api/org-structure/divisions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, actorEmployeeId }),
    });
  } catch {
    throw new ApiError('ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองใหม่อีกครั้ง', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.message ?? 'เพิ่มฝ่ายไม่สำเร็จ', res.status);
  }
  return data as OrgDivisionData[];
}

export async function renameOrgDivision(oldName: string, newName: string, actorEmployeeId: string): Promise<OrgDivisionData[]> {
  let res: Response;
  try {
    res = await authFetch(`${API_BASE_URL}/api/org-structure/divisions/${encodeURIComponent(oldName)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName, actorEmployeeId }),
    });
  } catch {
    throw new ApiError('ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองใหม่อีกครั้ง', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.message ?? 'เปลี่ยนชื่อฝ่ายไม่สำเร็จ', res.status);
  }
  return data as OrgDivisionData[];
}

export async function deleteOrgDivision(name: string, actorEmployeeId: string): Promise<OrgDivisionData[]> {
  let res: Response;
  try {
    res = await authFetch(
      `${API_BASE_URL}/api/org-structure/divisions/${encodeURIComponent(name)}?actorEmployeeId=${encodeURIComponent(actorEmployeeId)}`,
      { method: 'DELETE' }
    );
  } catch {
    throw new ApiError('ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองใหม่อีกครั้ง', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.message ?? 'ลบฝ่ายไม่สำเร็จ', res.status);
  }
  return data as OrgDivisionData[];
}

export async function addOrgSection(divisionName: string, sectionName: string, actorEmployeeId: string): Promise<OrgDivisionData[]> {
  let res: Response;
  try {
    res = await authFetch(`${API_BASE_URL}/api/org-structure/divisions/${encodeURIComponent(divisionName)}/sections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: sectionName, actorEmployeeId }),
    });
  } catch {
    throw new ApiError('ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองใหม่อีกครั้ง', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.message ?? 'เพิ่มแผนกไม่สำเร็จ', res.status);
  }
  return data as OrgDivisionData[];
}

export async function renameOrgSection(
  divisionName: string,
  oldName: string,
  newName: string,
  actorEmployeeId: string
): Promise<OrgDivisionData[]> {
  let res: Response;
  try {
    res = await authFetch(
      `${API_BASE_URL}/api/org-structure/divisions/${encodeURIComponent(divisionName)}/sections/${encodeURIComponent(oldName)}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, actorEmployeeId }),
      }
    );
  } catch {
    throw new ApiError('ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองใหม่อีกครั้ง', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.message ?? 'เปลี่ยนชื่อแผนกไม่สำเร็จ', res.status);
  }
  return data as OrgDivisionData[];
}

export async function deleteOrgSection(divisionName: string, sectionName: string, actorEmployeeId: string): Promise<OrgDivisionData[]> {
  let res: Response;
  try {
    res = await authFetch(
      `${API_BASE_URL}/api/org-structure/divisions/${encodeURIComponent(divisionName)}/sections/${encodeURIComponent(sectionName)}?actorEmployeeId=${encodeURIComponent(actorEmployeeId)}`,
      { method: 'DELETE' }
    );
  } catch {
    throw new ApiError('ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองใหม่อีกครั้ง', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.message ?? 'ลบแผนกไม่สำเร็จ', res.status);
  }
  return data as OrgDivisionData[];
}

// บันทึกกิจกรรม (audit log) — server/routes/audit-logs.ts. Small internal-tool dataset, always
// fetched whole (see that route's own note on why) so EmployeeManagement.tsx's existing
// client-side search/date/department/action filters keep working unmodified.
export async function fetchAuditLogs(): Promise<AuditLog[]> {
  const res = await authFetch(`${API_BASE_URL}/api/audit-logs`);
  if (!res.ok) throw new Error(`Failed to fetch audit logs: ${res.status}`);
  return res.json();
}

export async function createAuditLog(entry: AuditLog): Promise<AuditLog> {
  let res: Response;
  try {
    res = await authFetch(`${API_BASE_URL}/api/audit-logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
  } catch {
    throw new ApiError('ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองใหม่อีกครั้ง', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.message ?? 'บันทึกกิจกรรมไม่สำเร็จ', res.status);
  }
  return data as AuditLog;
}
