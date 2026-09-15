import { Employee, CredentialItem, Meeting, Notification } from '../types';
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

export async function updateEmployeeRemote(
  id: string,
  updates: Partial<Pick<Employee, 'name' | 'nickname' | 'role' | 'avatar' | 'department' | 'division' | 'username' | 'accountType' | 'restrictedMenuIds' | 'phone' | 'address'>> & { password?: string }
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/employees/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
  } catch {
    throw new ApiError('ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองใหม่อีกครั้ง', 0);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.message ?? 'บันทึกข้อมูลไม่สำเร็จ', res.status);
  }
}

export async function deleteEmployeeRemote(id: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/employees/${encodeURIComponent(id)}`, { method: 'DELETE' });
  } catch {
    throw new ApiError('ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองใหม่อีกครั้ง', 0);
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(data.message ?? 'ลบบัญชีไม่สำเร็จ', res.status);
  }
}

export async function fetchCredentials(): Promise<CredentialItem[]> {
  const res = await fetch(`${API_BASE_URL}/api/credentials`);
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
  Pick<ProjectRow, 'title' | 'description' | 'department' | 'type' | 'abbreviation' | 'priority' | 'budget' | 'ownerEmployeeId' | 'memberEmployeeIds' | 'memberDuties' | 'docFolderId' | 'progress' | 'status'>
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

export async function updateProjectRemote(id: string, updates: Partial<ProjectRow>): Promise<ProjectRow> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/projects/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
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

export async function deleteProjectRemote(id: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/projects/${encodeURIComponent(id)}`, { method: 'DELETE' });
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

export async function deleteMeetingRemote(id: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/meetings/${encodeURIComponent(id)}`, { method: 'DELETE' });
  } catch {
    throw new ApiError('ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองใหม่อีกครั้ง', 0);
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(data.message ?? 'ลบการประชุมไม่สำเร็จ', res.status);
  }
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

export async function updateProjectTaskRemote(id: string, updates: Partial<ProjectTaskItem>): Promise<ProjectTaskItem> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/project-tasks/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
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

export async function deleteProjectTaskRemote(id: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/project-tasks/${encodeURIComponent(id)}`, { method: 'DELETE' });
  } catch {
    throw new ApiError('ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองใหม่อีกครั้ง', 0);
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(data.message ?? 'ลบงานไม่สำเร็จ', res.status);
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
