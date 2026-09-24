import { useState } from 'react';
import { Employee, AccountType, ACCOUNT_TYPES } from '../types';
import { isNavAllowedByRole } from '../lib/permissions';
import Dropdown from './Dropdown';
import { NAV_ITEMS } from './layout/Sidebar';

// Shared between EmployeeManagement's create form and EmployeeProfileModal's edit mode — kept in
// one file so the two can't drift apart on what an admin is allowed to set.

// A plain admin can only ever hand out the "employee" level — admin/superadmin/ผู้บริหาร accounts
// can only be created or changed by a Super Admin or ผู้บริหาร (mirrors canEditOrDeleteTarget's
// "admin can't touch admin-like accounts" rule, extended to account-type assignment itself).
// The ผู้บริหาร title is capped at 2 people (enforced server-side, which tells the user to demote
// one first when a third is attempted) — both Super Admin and an existing ผู้บริหาร can give and
// take it back.
export function assignableAccountTypes(actingUser: Employee | undefined): AccountType[] {
  if (actingUser?.accountType === 'superadmin' || actingUser?.accountType === 'executive') {
    return [...ACCOUNT_TYPES];
  }
  return ['employee'];
}

// Menu ids an admin can restrict per-employee — dashboard is deliberately excluded since it's the
// app's fallback redirect target and must always stay reachable (see App.tsx's NavGuardRoute).
export const RESTRICTABLE_NAV_ITEMS = NAV_ITEMS.filter((item) => item.id !== 'dashboard' && item.id !== 'settings');

// Narrowed further to whatever the currently-selected account type could reach in the first
// place — e.g. "จัดการพนักงาน" never shows up for an "employee"-type account, since that role
// already can't open it regardless of restrictedMenuIds, so offering the checkbox would be a
// no-op that looks like it does something.
export function restrictableNavItemsFor(accountType: AccountType) {
  return RESTRICTABLE_NAV_ITEMS.filter((item) => isNavAllowedByRole({ accountType }, item.id));
}

export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function readFileAsDataUrl(file: globalThis.File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

const ADD_NEW_ROLE = '__add_new_role__';

// Two reserved ตำแหน่ง values that carry structural meaning beyond a plain job title: picking
// either one ties the employee to a ฝ่าย (and, for a department head, a แผนก within it) instead
// of the usual freeform department assignment — see roleExemptFromDepartment below.
export const DIVISION_HEAD_ROLE = 'หัวหน้าฝ่าย';
export const DEPARTMENT_HEAD_ROLE = 'หัวหน้าแผนก';
const RESERVED_ROLES = [DIVISION_HEAD_ROLE, DEPARTMENT_HEAD_ROLE];

// A division head oversees the whole ฝ่าย, not one แผนก under it — same exemption already given
// to ผู้บริหาร, since pinning either to a single department would misrepresent their actual scope.
// A department head still belongs to exactly one แผนก (within one ฝ่าย), so they're NOT exempt.
export function roleExemptFromDepartment(role: string): boolean {
  const trimmed = role.trim();
  return trimmed === 'ผู้บริหาร' || trimmed === DIVISION_HEAD_ROLE;
}

// ตำแหน่ง picker: a dropdown built from the 2 reserved structural roles plus every plain job
// title already in use, plus an "add new" entry that swaps in a free-text input — so admins reuse
// existing titles by default but can still introduce a brand-new one without leaving the form.
export function RoleField({ value, onChange, roleOptions }: { value: string; onChange: (v: string) => void; roleOptions: string[] }) {
  const [isCustom, setIsCustom] = useState(() => value !== '' && !roleOptions.includes(value) && !RESERVED_ROLES.includes(value));

  if (isCustom) {
    return (
      <div className="flex gap-2">
        <input
          type="text"
          required
          autoFocus
          placeholder="พิมพ์ตำแหน่งใหม่"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 min-w-0 p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#FF6537]"
        />
        {roleOptions.length > 0 && (
          <button
            type="button"
            onClick={() => { setIsCustom(false); onChange(''); }}
            className="px-3 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 cursor-pointer text-xs font-semibold shrink-0"
          >
            เลือกจากรายการ
          </button>
        )}
      </div>
    );
  }

  return (
    <Dropdown<string>
      value={value}
      placeholder="เลือกตำแหน่ง"
      onChange={(v) => {
        if (v === ADD_NEW_ROLE) { setIsCustom(true); onChange(''); }
        else onChange(v);
      }}
      options={[
        ...RESERVED_ROLES.map((r) => ({ value: r, label: r })),
        ...roleOptions.filter((r) => !RESERVED_ROLES.includes(r)).map((r) => ({ value: r, label: r })),
        { value: ADD_NEW_ROLE, label: '+ เพิ่มตำแหน่งใหม่' }
      ]}
    />
  );
}

// Lets an admin block a specific employee from specific Sidebar menus (on top of whatever their
// account type already allows) — see canAccessNavItem, which ANDs this list against the role check.
export function MenuRestrictionChecklist({ items, selectedIds, onChange }: { items: typeof RESTRICTABLE_NAV_ITEMS; selectedIds: string[]; onChange: (ids: string[]) => void }) {
  const toggle = (id: string) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  };
  if (items.length === 0) {
    return <p className="text-[11px] text-slate-500">ประเภทผู้ใช้งานนี้เข้าเมนูอื่นได้ทั้งหมดอยู่แล้ว ไม่มีเมนูให้จำกัดเพิ่ม</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {items.map((item) => (
        <label key={item.id} className="flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-600">
          <input
            type="checkbox"
            checked={selectedIds.includes(item.id)}
            onChange={() => toggle(item.id)}
            className="w-3.5 h-3.5 accent-[#FF6537] cursor-pointer shrink-0"
          />
          {item.label}
        </label>
      ))}
    </div>
  );
}
