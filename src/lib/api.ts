import { Employee, CredentialItem } from '../types';

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
  updates: Partial<Pick<Employee, 'name' | 'nickname' | 'role' | 'avatar' | 'department' | 'username'>> & { password?: string }
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
