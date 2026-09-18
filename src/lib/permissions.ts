import { AccountType, Employee } from '../types';

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  employee: 'พนักงาน',
  admin: 'Admin',
  superadmin: 'Super Admin',
  executive: 'ผู้บริหาร',
};

// admin/superadmin/executive reach Employee Management's full CRUD view; a plain employee gets
// the read-only directory view instead (see EmployeeDirectory.tsx / EmployeesPage.tsx).
export function canManageEmployees(actor: Pick<Employee, 'accountType'>): boolean {
  return actor.accountType === 'admin' || actor.accountType === 'superadmin' || actor.accountType === 'executive';
}

// ผู้บริหาร sees every project/task/doc/credential company-wide by default, regardless of
// ownership/membership — the one role exempt from every "รับผิดชอบ" scoping filter in the app.
export function canSeeAllProjects(actor: Pick<Employee, 'accountType'>): boolean {
  return actor.accountType === 'executive';
}

// Org structure (ผังองค์กร) editing is narrower than reaching Employee Management at all — a plain
// Admin can view the chart but not add/rename/delete divisions or sections; only Super Admin and
// ผู้บริหาร can.
export function canEditOrgStructure(actor: Pick<Employee, 'accountType'>): boolean {
  return actor.accountType === 'superadmin' || actor.accountType === 'executive';
}

function isAdminLike(accountType: AccountType): boolean {
  return accountType === 'admin' || accountType === 'superadmin' || accountType === 'executive';
}

// Who can delete a project from "จัดการงานและโครงการ" — a wider circle than canManageEmployees
// above, since executives (who never reach Employee Management) still need to be able to clean up
// projects.
export function canDeleteProject(actor: Pick<Employee, 'accountType'>): boolean {
  return actor.accountType === 'admin' || actor.accountType === 'superadmin' || actor.accountType === 'executive';
}

// superadmin/ผู้บริหาร can edit/delete anyone ("ผู้บริหาร ทำได้เหมือน Super Admin ทุกอย่าง" in
// Employee Management specifically). admin can edit/delete anyone EXCEPT another admin-like
// account (admin, superadmin, or executive) — matching "Admin ไม่สามารถแก้ไขหรือลบผู้ใช้ที่เป็น
// Admin/Super Admin/ผู้บริหาร ได้". Editing your own account is always allowed regardless of role.
export function canEditOrDeleteTarget(actor: Pick<Employee, 'id' | 'accountType'>, target: Pick<Employee, 'id' | 'accountType'>): boolean {
  if (actor.id === target.id) return true;
  if (actor.accountType === 'superadmin' || actor.accountType === 'executive') return true;
  if (actor.accountType === 'admin') return !isAdminLike(target.accountType);
  return false;
}

// Role-based default for a Sidebar nav item id, before that account's own `restrictedMenuIds`
// override is applied on top (see `canAccessNavItem` below). "employees" is reachable by every
// role now — canManageEmployees only decides which of EmployeeManagement (full CRUD) vs
// EmployeeDirectory (read-only) a plain employee's visit renders (see EmployeesPage.tsx).
export function isNavAllowedByRole(_actor: Pick<Employee, 'accountType'>, _navId: string): boolean {
  return true;
}

export function canAccessNavItem(actor: Pick<Employee, 'accountType' | 'restrictedMenuIds'>, navId: string): boolean {
  if (!isNavAllowedByRole(actor, navId)) return false;
  return !actor.restrictedMenuIds?.includes(navId);
}
