import type { RowDataPacket } from 'mysql2';
import { parseMutedCategories } from './notificationCategories.ts';

export interface EmployeeRow extends RowDataPacket {
  id: string;
  name: string;
  nickname: string | null;
  email: string;
  username: string | null;
  phone: string | null;
  address: string | null;
  role: string;
  department: string;
  division: string | null;
  avatar: string | null;
  account_type: string;
  restricted_menu_ids: string | null;
  muted_notification_categories: string | null;
  created_at: string;
}

// Shared by GET /api/employees and /api/auth/login (which hands the freshly-logged-in employee back
// directly, so the client no longer needs the whole directory before anyone has signed in).
export const EMPLOYEE_SELECT = `SELECT e.id, e.name, e.nickname, e.email, l.username, e.phone, e.address, e.role, e.department, e.division, e.avatar, e.account_type, e.restricted_menu_ids, e.muted_notification_categories, e.created_at
       FROM employee e
       LEFT JOIN login l ON l.employee_id = e.id`;

// camelCase to match the Employee type in src/types.ts.
export function toEmployeeDto(r: EmployeeRow) {
  return {
    id: r.id,
    name: r.name,
    nickname: r.nickname || r.name,
    email: r.email,
    username: r.username,
    phone: r.phone || undefined,
    address: r.address || undefined,
    role: r.role,
    department: r.department,
    division: r.division || undefined,
    avatar: r.avatar,
    accountType: r.account_type,
    restrictedMenuIds: r.restricted_menu_ids ? JSON.parse(r.restricted_menu_ids) : undefined,
    mutedNotificationCategories: parseMutedCategories(r.muted_notification_categories),
    createdAt: r.created_at,
  };
}
