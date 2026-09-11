import { AccountType, Employee } from '../types';

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  employee: 'พนักงาน',
  admin: 'Admin',
  superadmin: 'Super Admin',
  executive: 'ผู้บริหาร',
};

// admin/superadmin both reach Employee Management's full CRUD view; employee/executive (once
// their own read-only directory view exists) never do.
export function canManageEmployees(actor: Pick<Employee, 'accountType'>): boolean {
  return actor.accountType === 'admin' || actor.accountType === 'superadmin';
}

function isAdminLike(accountType: AccountType): boolean {
  return accountType === 'admin' || accountType === 'superadmin';
}

// Who can delete a project from "จัดการงานและโครงการ" — a wider circle than canManageEmployees
// above, since executives (who never reach Employee Management) still need to be able to clean up
// projects.
export function canDeleteProject(actor: Pick<Employee, 'accountType'>): boolean {
  return actor.accountType === 'admin' || actor.accountType === 'superadmin' || actor.accountType === 'executive';
}

// superadmin can edit/delete anyone. admin can edit/delete anyone EXCEPT another admin-like
// account (admin or superadmin) — matching "Admin ไม่สามารถแก้ไขหรือลบผู้ใช้ที่เป็น Admin เหมือนกัน
// ได้" (and superadmin counts as "admin-like" too, from a plain admin's point of view). Editing
// your own account is always allowed regardless of role.
export function canEditOrDeleteTarget(actor: Pick<Employee, 'id' | 'accountType'>, target: Pick<Employee, 'id' | 'accountType'>): boolean {
  if (actor.id === target.id) return true;
  if (actor.accountType === 'superadmin') return true;
  if (actor.accountType === 'admin') return !isAdminLike(target.accountType);
  return false;
}

// Role-based default for a Sidebar nav item id, before that account's own `restrictedMenuIds`
// override is applied on top (see `canAccessNavItem` below). Exported so the Employee Management
// form can hide the "restrict this menu" checkbox for an item the selected account type could
// never reach anyway (e.g. "จัดการพนักงาน" for a plain employee) — checking/unchecking it there
// would be a no-op, so offering it at all is misleading.
export function isNavAllowedByRole(actor: Pick<Employee, 'accountType'>, navId: string): boolean {
  if (navId === 'employees') return canManageEmployees(actor);
  return true;
}

export function canAccessNavItem(actor: Pick<Employee, 'accountType' | 'restrictedMenuIds'>, navId: string): boolean {
  if (!isNavAllowedByRole(actor, navId)) return false;
  return !actor.restrictedMenuIds?.includes(navId);
}
