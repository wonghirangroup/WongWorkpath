import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Plus, X, Search, Mail, Briefcase, Pencil, Trash2, Eye, AtSign, ScrollText, LayoutGrid, List, Crown, Network, LocateFixed } from 'lucide-react';
import { Employee, Division, AccountType, AuditLog } from '../types';
import { ApiError } from '../lib/api';
import { getAvatarColor } from '../lib/avatarColor';
import { getDepartmentTagClass } from '../lib/departmentColors';
import { formatThaiDateTimeShort } from '../lib/datetime';
import { ACCOUNT_TYPE_LABELS, canEditOrDeleteTarget, canEditOrgStructure, isNavAllowedByRole } from '../lib/permissions';
import { useAppData } from '../context/AppDataContext';
import Dropdown from './Dropdown';
import OrgChart, { OrgChartHandle, EmployeeLocateSearch } from './OrgChart';
import EmployeeProfileModal from './EmployeeProfileModal';
import {
  readFileAsDataUrl,
  MAX_AVATAR_BYTES,
  formatFileSize,
  RoleField,
  MenuRestrictionChecklist,
  assignableAccountTypes,
  restrictableNavItemsFor,
  roleExemptFromDepartment,
} from './EmployeeFormShared';
import Tooltip from './Tooltip';
import ThaiDatePicker from './ThaiDatePicker';
import PendingRequestCard from './projectBoard/PendingRequestCard';
import { useEscapeToClose } from '../lib/useEscapeToClose';

const DEFAULT_PASSWORD = 'Wongwork2026!';

// Continues the seeded E01, E02, ... sequence instead of a Date.now()-based id, so ids stay
// short and ordered. Ids longer than 4 digits (e.g. a legacy Date.now() id) are ignored when
// finding the current max, so one bad historical id can't push every id after it out of sequence.
function getNextEmployeeId(employees: Employee[]): string {
  const maxNum = employees.reduce((max, emp) => {
    const match = /^E(\d{1,4})$/.exec(emp.id);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `E${String(maxNum + 1).padStart(2, '0')}`;
}

// Direct icon buttons instead of a "..." menu — view/edit/delete are the only actions here, so
// hiding them behind an extra click added a step without saving any real space.
function EmployeeCardMenu({ onView, onEdit, onDelete, deleteDisabled, editDisabled }: { onView: () => void; onEdit: () => void; onDelete: () => void; deleteDisabled: boolean; editDisabled: boolean }) {
  return (
    <div className="flex items-center gap-0.5 shrink-0">
      <Tooltip content="ดูรายละเอียด">
        <button
          onClick={onView}
          aria-label="ดูรายละเอียด"
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
        >
          <Eye size={15} />
        </button>
      </Tooltip>
      {!editDisabled && (
        <Tooltip content="แก้ไข">
          <button
            onClick={onEdit}
            aria-label="แก้ไข"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            <Pencil size={15} />
          </button>
        </Tooltip>
      )}
      {!deleteDisabled && (
        <Tooltip content="ลบ">
          <button
            onClick={onDelete}
            aria-label="ลบ"
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
          >
            <Trash2 size={15} />
          </button>
        </Tooltip>
      )}
    </div>
  );
}

interface EmployeeManagementProps {
  employees: Employee[];
  auditLogs: AuditLog[];
  currentUserId?: string;
  onAddEmployee: (employee: Employee & { password: string }) => Promise<void>;
  onUpdateEmployee: (
    id: string,
    updates: Partial<Pick<Employee, 'name' | 'nickname' | 'role' | 'avatar' | 'department' | 'division' | 'username' | 'accountType' | 'restrictedMenuIds' | 'phone' | 'address'>> & { password?: string }
  ) => Promise<void>;
  onDeleteEmployee: (id: string, reason: string) => Promise<void>;
}

export default function EmployeeManagement({ employees, auditLogs, currentUserId, onAddEmployee, onUpdateEmployee, onDeleteEmployee }: EmployeeManagementProps) {
  const {
    orgDivisions,
    orgSections,
    handleAddDivision,
    handleRenameDivision,
    handleDeleteDivision,
    handleAddSection,
    handleRenameSection,
    handleDeleteSection,
    changeRequests,
    handleDecideChangeRequest
  } = useAppData();
  // Name/nickname change requests filed from Settings by plain employees — decided right here,
  // since this whole page is already limited to accounts allowed to approve them.
  const pendingEmployeeRequests = changeRequests.filter((r) => r.entityType === 'employee' && r.status === 'pending');
  const getSectionsForDivision = (divisionName: string) =>
    orgDivisions.find((d) => d.name === divisionName)?.sections ?? [];

  const [activeTab, setActiveTab] = useState<'employees' | 'org' | 'logs'>('employees');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('__all__');
  const [logSearchTerm, setLogSearchTerm] = useState('');
  const [logDateFilter, setLogDateFilter] = useState('');
  const [logDepartmentFilter, setLogDepartmentFilter] = useState<string>('__all__');
  const [logActionFilter, setLogActionFilter] = useState<string>('__all__');
  // "โครงสร้างองค์กร" tab's own search/filter row now lives up here (see the toolbar block below),
  // matching every other tab, instead of inside <OrgChart> itself — its canvas still owns the
  // pan/zoom/DOM-measurement machinery, reached imperatively via orgChartRef (see OrgChartHandle).
  const [orgFilterDivision, setOrgFilterDivision] = useState('__all__');
  const [orgEditMode, setOrgEditMode] = useState(false);
  const orgChartRef = useRef<OrgChartHandle>(null);
  const currentUserInOrgChart = Boolean(currentUserId && employees.some((e) => e.id === currentUserId));

  // Click-to-mark a single card/row (purely visual — a persistent "hover-look" pin, not a
  // multi-select). Only clicking outside every card/row unmarks it, via data-markable-id below.
  // Shared across the employee and log tables since only one is ever rendered at a time.
  const [markedId, setMarkedId] = useState<string | null>(null);
  useEffect(() => {
    if (!markedId) return;
    const handleClickOutside = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('[data-markable-id]')) return;
      setMarkedId(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [markedId]);

  // The employee/log table's max-height used to be a hardcoded `calc(100vh - Npx)` guess at how
  // much space the header + sticky toolbar above it consume — that number drifts whenever the
  // toolbar's own height changes (e.g. its filter row wrapping at a narrower width), so it was
  // consistently either too short (dead gray space below the table) or too tall (table overflows
  // past the sidebar's bottom edge). Measuring the real gap live removes the guesswork.
  const [tableMaxHeight, setTableMaxHeight] = useState<number>();
  const tableWrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function updateTableMaxHeight() {
      if (!tableWrapRef.current) return;
      const top = tableWrapRef.current.getBoundingClientRect().top;
      setTableMaxHeight(window.innerHeight - top - 18); // 18px matches <main>'s own bottom padding
    }
    updateTableMaxHeight();
    window.addEventListener('resize', updateTableMaxHeight);
    return () => window.removeEventListener('resize', updateTableMaxHeight);
  }, [activeTab, viewMode]);

  // The one employee record for whoever is using this page right now — needed to decide which
  // account types they're allowed to hand out (assignableAccountTypes) and which other accounts
  // they're allowed to edit/delete (canEditOrDeleteTarget).
  const actingUser = employees.find((e) => e.id === currentUserId);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newNickname, setNewNickname] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newDivision, setNewDivision] = useState<Division>(orgDivisions[0]?.name ?? '');
  const [newDepartment, setNewDepartment] = useState<string>(getSectionsForDivision(orgDivisions[0]?.name ?? '')[0] ?? '');
  const [newAccountType, setNewAccountType] = useState<AccountType>('employee');
  const [newRestrictedMenuIds, setNewRestrictedMenuIds] = useState<string[]>([]);
  const [newAvatar, setNewAvatar] = useState('');
  const [newAvatarFileError, setNewAvatarFileError] = useState('');
  const [newPassword, setNewPassword] = useState(DEFAULT_PASSWORD);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addSuccessNotice, setAddSuccessNotice] = useState(false);

  // Profile modal — replaces the old separate "edit" form modal. Both the card's "ดูรายละเอียด"
  // (view) and "แก้ไข" (edit) icons open the same full-screen EmployeeProfileModal, just starting
  // in a different mode; the modal itself owns all of its own form state.
  const [profileModal, setProfileModal] = useState<{ employeeId: string; mode: 'view' | 'edit' } | null>(null);
  const [profileSaveSuccess, setProfileSaveSuccess] = useState(false);

  // superadmin can edit/delete anyone; admin can edit/delete anyone except another admin-like
  // (admin or superadmin) account — see canEditOrDeleteTarget for the exact rule. Viewing (as
  // opposed to editing) another admin's details is always allowed — it's not destructive.
  const isEditLockedForAdmin = (emp: Employee) => !actingUser || !canEditOrDeleteTarget(actingUser, emp);
  // Admin can view the org chart but not add/rename/delete divisions or sections — only Super
  // Admin/ผู้บริหาร can. Org structure has no backend route (still localStorage-only), so this is
  // a pure client-side gate.
  const canEditOrg = Boolean(actingUser && canEditOrgStructure(actingUser));

  const openProfile = (emp: Employee, mode: 'view' | 'edit') => {
    if (mode === 'edit' && isEditLockedForAdmin(emp)) return;
    setProfileModal({ employeeId: emp.id, mode });
  };

  const handleNewAvatarFilePicked = async (file: globalThis.File | null) => {
    setNewAvatarFileError('');
    if (!file) return;
    if (file.size > MAX_AVATAR_BYTES) {
      setNewAvatarFileError(`ไฟล์ใหญ่เกินไป (${formatFileSize(file.size)}) — อัปโหลดได้ไม่เกิน ${formatFileSize(MAX_AVATAR_BYTES)}`);
      return;
    }
    setNewAvatar(await readFileAsDataUrl(file));
  };

  // Delete confirmation — requires a reason, logged to the audit trail alongside the deletion.
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const closeDeleteModal = () => {
    setDeleteTarget(null);
    setDeleteReason('');
    setDeleteError('');
  };

  useEscapeToClose(Boolean(deleteTarget), closeDeleteModal);

  const confirmDelete = async () => {
    if (!deleteTarget || !deleteReason.trim()) return;
    setIsDeleting(true);
    setDeleteError('');
    try {
      await onDeleteEmployee(deleteTarget.id, deleteReason.trim());
      closeDeleteModal();
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'ลบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsDeleting(false);
    }
  };

  const resetForm = () => {
    setNewName('');
    setNewNickname('');
    setNewEmail('');
    setNewPhone('');
    setNewUsername('');
    setNewRole('');
    setNewDivision(orgDivisions[0]?.name ?? '');
    setNewDepartment(getSectionsForDivision(orgDivisions[0]?.name ?? '')[0] ?? '');
    setNewAccountType('employee');
    setNewRestrictedMenuIds([]);
    setNewAvatar('');
    setNewAvatarFileError('');
    setNewPassword(DEFAULT_PASSWORD);
    setFormError('');
    setShowAddForm(false);
  };

  useEscapeToClose(showAddForm, resetForm);

  // ผู้บริหาร and หัวหน้าฝ่าย both sit over a whole ฝ่าย, not one แผนก under it — these are the
  // roles that don't need a department pinned to them (see server/routes/employees.ts for the
  // matching relaxed check). หัวหน้าแผนก still belongs to exactly one แผนก, so it's not exempt.
  const hidesDepartmentField = roleExemptFromDepartment(newRole);

  const isFormValid = !!(
    newName.trim() && newEmail.trim() && newUsername.trim() && newRole.trim() && newPassword.trim()
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || isSubmitting) return;
    setFormError('');
    setIsSubmitting(true);
    try {
      await onAddEmployee({
        id: getNextEmployeeId(employees),
        name: newName.trim(),
        nickname: newNickname.trim() || newName.trim(),
        email: newEmail.trim(),
        phone: newPhone.trim() || undefined,
        username: newUsername.trim(),
        role: newRole.trim(),
        department: hidesDepartmentField ? '' : newDepartment,
        division: newDivision,
        avatar: newAvatar.trim(),
        accountType: newAccountType,
        ...(newRestrictedMenuIds.length ? { restrictedMenuIds: newRestrictedMenuIds } : {}),
        password: newPassword
      });
      resetForm();
      setAddSuccessNotice(true);
      setTimeout(() => setAddSuccessNotice(false), 3000);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'สร้างบัญชีพนักงานไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSubmitting(false);
    }
  };

  const roleOptions = Array.from(new Set(employees.map((emp) => emp.role).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'th'));

  const filteredEmployees = employees.filter((emp) => {
    const query = searchTerm.trim().toLowerCase();
    const matchesQuery = !query
      || emp.name.toLowerCase().includes(query)
      || (emp.nickname || '').toLowerCase().includes(query)
      || emp.email.toLowerCase().includes(query)
      || (emp.username || '').toLowerCase().includes(query);
    const matchesDepartment = departmentFilter === '__all__' || emp.department === departmentFilter;
    return matchesQuery && matchesDepartment;
  });

  const logActionOptions = Array.from(new Set(auditLogs.map((log) => log.action))).sort();

  const filteredLogs = auditLogs.filter((log) => {
    const query = logSearchTerm.trim().toLowerCase();
    const matchesQuery = !query
      || log.user.toLowerCase().includes(query)
      || log.action.toLowerCase().includes(query)
      || log.details.toLowerCase().includes(query);
    const matchesDate = !logDateFilter || log.timestamp.slice(0, 10) === logDateFilter;
    const matchesDepartment = logDepartmentFilter === '__all__' || log.department === logDepartmentFilter;
    const matchesAction = logActionFilter === '__all__' || log.action === logActionFilter;
    return matchesQuery && matchesDate && matchesDepartment && matchesAction;
  });

  return (
    <div className="space-y-6" id="employee-management-tab">
      {/* Tabs + whichever tab's search/filter row are grouped into one sticky unit so both stay
          pinned below the (already-sticky) page header while the table scrolls underneath —
          rather than each row needing its own independently-computed sticky offset. Negative
          top looks backwards, but sticky's `top` is relative to <main>'s padding-box edge, not
          the viewport, so it lands at (header height + <main>'s own top padding + this value) —
          the negative value here is exactly what cancels <main>'s own padding back out so this
          sits flush against the header with no gap for table rows to show through. */}
      <div className="sticky -top-4 sm:-top-6 lg:-top-3.75 z-30 bg-[#F6F6F6] pt-1 space-y-4">
      {activeTab === 'employees' ? (
      <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
        <div className="relative w-full lg:w-137.5 lg:flex-none">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ค้นหาพนักงาน (ชื่อ / อีเมล)"
            className="w-full h-10 pl-9 pr-9 bg-white border border-slate-200 rounded-xl text-[13px] font-normal focus:outline-none focus:border-[#FF6537]"
          />
          {searchTerm && (
            <Tooltip content="ล้างคำค้นหา">
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                aria-label="ล้างคำค้นหา"
              >
                <X size={15} />
              </button>
            </Tooltip>
          )}
        </div>

        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex items-center gap-0.5 bg-white border border-slate-200 rounded-xl p-1 shrink-0">
            <Tooltip content="มุมมองการ์ด">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6537] focus-visible:ring-offset-1 ${viewMode === 'grid' ? 'bg-[#FF6537] text-white' : 'text-[#6F6F6F] hover:text-[#272220]'}`}
                aria-label="มุมมองการ์ด"
              >
                <LayoutGrid size={15} />
              </button>
            </Tooltip>
            <Tooltip content="มุมมองรายการ">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6537] focus-visible:ring-offset-1 ${viewMode === 'list' ? 'bg-[#FF6537] text-white' : 'text-[#6F6F6F] hover:text-[#272220]'}`}
                aria-label="มุมมองรายการ"
              >
                <List size={15} />
              </button>
            </Tooltip>
          </div>

          <div className="w-36 h-10">
            <Dropdown<string>
              value={departmentFilter}
              onChange={setDepartmentFilter}
              options={[
                { value: '__all__', label: 'ทุกแผนก' },
                ...orgSections.map((d) => ({ value: d, label: d }))
              ]}
            />
          </div>

          <button
            onClick={() => setShowAddForm(true)}
            className="bg-[#FF6537] hover:opacity-90 text-white text-sm font-bold px-4 h-10 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap lg:ml-auto"
          >
            <Plus size={16} /> เพิ่มพนักงานใหม่
          </button>
        </div>
      </div>
      ) : activeTab === 'logs' ? (
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
          <div className="relative w-full lg:w-137.5 lg:flex-none">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={logSearchTerm}
              onChange={(e) => setLogSearchTerm(e.target.value)}
              placeholder="ค้นหา Log (ผู้ใช้ / การกระทำ / รายละเอียด)"
              className="w-full h-10 pl-9 pr-9 bg-white border border-slate-200 rounded-xl text-[13px] font-normal focus:outline-none focus:border-[#FF6537]"
            />
            {logSearchTerm && (
              <Tooltip content="ล้างคำค้นหา">
                <button
                  type="button"
                  onClick={() => setLogSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  aria-label="ล้างคำค้นหา"
                >
                  <X size={15} />
                </button>
              </Tooltip>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="w-40">
              <ThaiDatePicker value={logDateFilter} onChange={setLogDateFilter} compact placeholder="กรองตามวันที่" />
            </div>
            <div className="w-36 h-10">
              <Dropdown<string>
                value={logDepartmentFilter}
                onChange={setLogDepartmentFilter}
                options={[
                  { value: '__all__', label: 'ทุกแผนก' },
                  ...orgSections.map((d) => ({ value: d, label: d }))
                ]}
              />
            </div>
            <div className="w-44 h-10">
              <Dropdown<string>
                value={logActionFilter}
                onChange={setLogActionFilter}
                options={[
                  { value: '__all__', label: 'ทุกการกระทำ' },
                  ...logActionOptions.map((a) => ({ value: a, label: a }))
                ]}
              />
            </div>
            {(logDateFilter || logDepartmentFilter !== '__all__' || logActionFilter !== '__all__') && (
              <button
                type="button"
                onClick={() => { setLogDateFilter(''); setLogDepartmentFilter('__all__'); setLogActionFilter('__all__'); }}
                className="text-[12px] text-slate-500 hover:text-[#FF6537] underline cursor-pointer"
              >
                ล้างตัวกรอง
              </button>
            )}
          </div>
        </div>
      ) : activeTab === 'org' ? (
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
          <div className="w-full lg:w-137.5 lg:flex-none">
            <EmployeeLocateSearch employees={employees} onSelect={(id) => orgChartRef.current?.focusOnEmployee(id)} />
          </div>

          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-44 h-10 shrink-0">
              <Dropdown<string>
                value={orgFilterDivision}
                onChange={setOrgFilterDivision}
                size="compact"
                options={[{ value: '__all__', label: 'ทุกฝ่าย' }, ...orgDivisions.map((d) => ({ value: d.name, label: d.name }))]}
              />
            </div>
            {currentUserInOrgChart && (
              <Tooltip content="ไปที่ตำแหน่งของฉันในผังองค์กร">
                <button
                  type="button"
                  onClick={() => orgChartRef.current?.focusOnEmployee(currentUserId!)}
                  aria-label="ตำแหน่งของฉัน"
                  className="flex items-center gap-1.5 h-10 px-3.5 rounded-xl text-xs font-semibold text-[#272220] bg-white border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors shrink-0"
                >
                  <LocateFixed size={14} /> ตำแหน่งของฉัน
                </button>
              </Tooltip>
            )}

            {canEditOrg && (
            <div className="flex items-center gap-2 lg:ml-auto shrink-0">
              {orgEditMode && (
                <button
                  type="button"
                  onClick={() => orgChartRef.current?.openAddDivisionPrompt()}
                  className="flex items-center gap-1 h-9 px-3 rounded-lg text-xs font-semibold text-[#FF6537] border border-[#FF6537] hover:bg-[#FFF1EC] cursor-pointer"
                >
                  <Plus size={13} /> เพิ่มฝ่าย
                </button>
              )}
              <button
                type="button"
                onClick={() => setOrgEditMode((v) => !v)}
                className={`flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                  orgEditMode ? 'bg-[#FF6537] text-white' : 'bg-[#F4F4F5] text-[#6F6F6F] hover:bg-slate-200'
                }`}
              >
                <Pencil size={13} /> {orgEditMode ? 'เสร็จสิ้นการแก้ไข' : 'แก้ไขโครงสร้าง'}
              </button>
            </div>
            )}
          </div>
        </div>
      ) : null}

      <div className="flex items-center gap-0.5 bg-white border border-slate-200 rounded-xl p-1 w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('employees')}
          className={`flex items-center gap-1.5 px-3.5 h-8 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
            activeTab === 'employees' ? 'bg-[#FF6537] text-white' : 'text-[#6F6F6F] hover:text-[#272220]'
          }`}
        >
          <Briefcase size={13} /> รายชื่อพนักงาน
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('org')}
          className={`flex items-center gap-1.5 px-3.5 h-8 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
            activeTab === 'org' ? 'bg-[#FF6537] text-white' : 'text-[#6F6F6F] hover:text-[#272220]'
          }`}
        >
          <Network size={13} /> โครงสร้างองค์กร
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('logs')}
          className={`flex items-center gap-1.5 px-3.5 h-8 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
            activeTab === 'logs' ? 'bg-[#FF6537] text-white' : 'text-[#6F6F6F] hover:text-[#272220]'
          }`}
        >
          <ScrollText size={13} /> บันทึกกิจกรรม (Log)
        </button>
      </div>
      </div>

      {activeTab === 'employees' && pendingEmployeeRequests.length > 0 && (
        <div className="bg-white rounded-2xl border border-amber-200 shadow-[0px_2px_7px_-1px_rgba(0,0,0,0.1)] p-5 space-y-3">
          <h3 className="font-bold text-[#272220]">คำขอเปลี่ยนชื่อรออนุมัติ ({pendingEmployeeRequests.length})</h3>
          {pendingEmployeeRequests.map((request) => {
            const requester = employees.find((e) => e.id === request.entityId);
            const proposed = (request.proposedChanges ?? {}) as { name?: string; nickname?: string };
            const changes = [
              proposed.name && `ชื่อ-นามสกุล ${requester?.name ?? '-'} → ${proposed.name}`,
              proposed.nickname && `ชื่อเล่น ${requester?.nickname || requester?.name || '-'} → ${proposed.nickname}`,
            ].filter(Boolean).join(' · ');
            return (
              <PendingRequestCard
                key={request.id}
                request={request}
                entityTitle={changes || 'ชื่อ/ชื่อเล่น'}
                requesterLabel={requester ? requester.nickname || requester.name : 'ไม่ทราบผู้ใช้งาน'}
                canDecide
                onDecide={(decision, note) => handleDecideChangeRequest(request.id, decision, note)}
              />
            );
          })}
        </div>
      )}

      {activeTab === 'employees' ? (
      <>
      <p className="font-normal text-[16px] text-[#6F6F6F] leading-none">ทั้งหมด {filteredEmployees.length} คน</p>

      {filteredEmployees.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-2xl p-10 text-center text-slate-400 text-sm">
          {employees.length === 0 ? 'ยังไม่มีพนักงานในระบบ' : 'ไม่พบรายการที่ตรงกับการค้นหา'}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredEmployees.map((emp) => (
            <div
              key={emp.id}
              data-markable-id={emp.id}
              onClick={() => setMarkedId(emp.id)}
              className={`bg-white shadow-[0px_2px_7px_-1px_rgba(0,0,0,0.1)] p-4 rounded-2xl space-y-3 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg cursor-pointer ${
                markedId === emp.id ? 'shadow-lg' : ''
              }`}
              style={markedId === emp.id ? { transform: 'translateY(-4px)' } : undefined}
            >
              <div className="flex items-start gap-3">
                {emp.avatar ? (
                  <img src={emp.avatar} alt="" className="w-12 h-12 rounded-full object-cover shrink-0 bg-slate-50 border border-slate-100" />
                ) : (
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold shrink-0"
                    style={{ backgroundColor: getAvatarColor(emp.name) }}
                  >
                    {emp.name.trim().charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h4 className="text-[15px] font-bold text-[#272220] truncate flex items-center gap-1.5">
                    <span className="truncate">{emp.nickname || emp.name}</span>
                    {emp.accountType !== 'employee' && (
                      <span className="shrink-0 inline-flex items-center gap-1 text-[9px] font-bold uppercase px-2 py-0.5 rounded-full leading-none text-[#FF6537] bg-black border border-[#FF6537]">
                        <Crown size={9} className="fill-current" />
                        {ACCOUNT_TYPE_LABELS[emp.accountType]}
                      </span>
                    )}
                  </h4>
                  {emp.nickname && emp.nickname !== emp.name && (
                    <p className="text-[11px] text-slate-400 truncate">{emp.name}</p>
                  )}
                  {emp.department && (
                    <span className={`inline-block text-[9px] font-semibold px-1.5 py-0.5 rounded-full leading-none ${getDepartmentTagClass(emp.department)}`}>
                      {emp.department}
                    </span>
                  )}
                </div>
                <EmployeeCardMenu
                  onView={() => openProfile(emp, 'view')}
                  onEdit={() => openProfile(emp, 'edit')}
                  onDelete={() => setDeleteTarget({ id: emp.id, name: emp.name })}
                  deleteDisabled={emp.id === currentUserId || isEditLockedForAdmin(emp)}
                  editDisabled={isEditLockedForAdmin(emp)}
                />
              </div>

              <div className="pt-2 border-t border-[#EDEEEF] space-y-1.5">
                <div className="flex items-center gap-1.5 text-[12px] text-[#6F6F6F] min-w-0">
                  <Briefcase size={12} className="shrink-0" />
                  <span className="truncate">{emp.role}</span>
                </div>
                {emp.username && (
                  <div className="flex items-center gap-1.5 text-[12px] text-[#6F6F6F] min-w-0">
                    <AtSign size={12} className="shrink-0" />
                    <span className="truncate">{emp.username}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-[12px] text-[#6F6F6F] min-w-0">
                  <Mail size={12} className="shrink-0" />
                  <span className="truncate">{emp.email}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div ref={tableWrapRef} style={{ maxHeight: tableMaxHeight }} className="bg-white rounded-2xl border border-slate-100 shadow-[0px_2px_7px_-1px_rgba(0,0,0,0.1)] overflow-x-auto overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              {/* Sticky lives on each <th>, not <thead>/<tr> — position:sticky on a
                  table-header-group or table-row box is inert in most browsers; table cells
                  (display:table-cell) are what actually support it. It also needs this wrapper
                  to be the scrolling element: overflow-x-auto here implicitly computes
                  overflow-y to auto too (a CSS rule, not a typo), which — without an explicit
                  max-height — makes this div a zero-overflow, non-scrolling "scroll container"
                  that becomes the sticky reference frame instead of <main>, so sticky never
                  visually engages against the page's real scrolling. Bounding the height here
                  makes this div the thing that actually scrolls, so top-0 below just works. */}
              <tr className="bg-[#F9F9F9] text-[12px] font-semibold text-[#000000] border-b border-[#EDEEEF]">
                <th className="px-4 py-3 whitespace-nowrap sticky top-0 z-20 bg-[#F9F9F9]">ชื่อ</th>
                <th className="px-4 py-3 whitespace-nowrap sticky top-0 z-20 bg-[#F9F9F9]">ตำแหน่ง</th>
                <th className="px-4 py-3 whitespace-nowrap sticky top-0 z-20 bg-[#F9F9F9]">Username</th>
                <th className="px-4 py-3 whitespace-nowrap sticky top-0 z-20 bg-[#F9F9F9]">อีเมล</th>
                <th className="px-4 py-3 whitespace-nowrap sticky top-0 z-20 bg-[#F9F9F9]">แผนก</th>
                <th className="px-4 py-3 whitespace-nowrap sticky top-0 z-20 bg-[#F9F9F9]">การกระทำ</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map((emp) => (
                <tr
                  key={emp.id}
                  data-markable-id={emp.id}
                  onClick={() => setMarkedId(emp.id)}
                  className={`border-b border-[#EDEEEF] last:border-b-0 cursor-pointer ${markedId === emp.id ? 'bg-slate-200' : 'bg-white hover:bg-slate-50'}`}
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2.5">
                      {emp.avatar ? (
                        <img src={emp.avatar} alt="" className="w-9 h-9 rounded-full object-cover shrink-0 bg-slate-50 border border-slate-100" />
                      ) : (
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0"
                          style={{ backgroundColor: getAvatarColor(emp.name) }}
                        >
                          {emp.name.trim().charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-[13px] font-bold text-slate-900 leading-tight flex items-center gap-1.5">
                          <span className="truncate">{emp.nickname || emp.name}</span>
                          {emp.accountType !== 'employee' && (
                            <span className="shrink-0 inline-flex items-center gap-1 text-[9px] font-bold uppercase px-2 py-0.5 rounded-full leading-none text-[#FF6537] bg-black border border-[#FF6537]">
                              <Crown size={9} className="fill-current" />
                              {ACCOUNT_TYPE_LABELS[emp.accountType]}
                            </span>
                          )}
                        </p>
                        {emp.nickname && emp.nickname !== emp.name && (
                          <p className="text-[11px] text-slate-400 leading-tight truncate">{emp.name}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-[12px] font-normal text-[#6F6F6F]">{emp.role}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-[12px] font-normal text-[#6F6F6F]">{emp.username || '—'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-[12px] font-normal text-[#6F6F6F]">{emp.email}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {emp.department ? (
                      <span className={`inline-block text-[9px] font-semibold px-1.5 py-0.5 rounded-full leading-none ${getDepartmentTagClass(emp.department)}`}>
                        {emp.department}
                      </span>
                    ) : (
                      <span className="text-[#A0A0A0]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <EmployeeCardMenu
                      onView={() => openProfile(emp, 'view')}
                      onEdit={() => openProfile(emp, 'edit')}
                      onDelete={() => setDeleteTarget({ id: emp.id, name: emp.name })}
                      deleteDisabled={emp.id === currentUserId || isEditLockedForAdmin(emp)}
                      editDisabled={isEditLockedForAdmin(emp)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </>
      ) : activeTab === 'org' ? (
        <OrgChart
          ref={orgChartRef}
          employees={employees}
          orgDivisions={orgDivisions}
          filterDivision={orgFilterDivision}
          onFilterDivisionChange={setOrgFilterDivision}
          editMode={orgEditMode}
          onEditModeChange={setOrgEditMode}
          onAddDivision={handleAddDivision}
          onRenameDivision={handleRenameDivision}
          onDeleteDivision={handleDeleteDivision}
          onAddSection={handleAddSection}
          onRenameSection={handleRenameSection}
          onDeleteSection={handleDeleteSection}
        />
      ) : (
      <>
        {filteredLogs.length === 0 ? (
          <div className="bg-white border border-slate-100 rounded-2xl p-10 text-center text-slate-400 text-sm">
            {auditLogs.length === 0 ? 'ยังไม่มีบันทึกกิจกรรม' : 'ไม่พบรายการที่ตรงกับการค้นหา'}
          </div>
        ) : (
          <div ref={tableWrapRef} style={{ maxHeight: tableMaxHeight }} className="bg-white rounded-2xl border border-slate-100 shadow-[0px_2px_7px_-1px_rgba(0,0,0,0.1)] overflow-x-auto overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F9F9F9] text-[12px] font-semibold text-[#000000] border-b border-[#EDEEEF]">
                  <th className="px-4 py-3 whitespace-nowrap sticky top-0 z-20 bg-[#F9F9F9]">เวลา</th>
                  <th className="px-4 py-3 whitespace-nowrap sticky top-0 z-20 bg-[#F9F9F9]">ผู้ใช้</th>
                  <th className="px-4 py-3 whitespace-nowrap sticky top-0 z-20 bg-[#F9F9F9]">ตำแหน่ง</th>
                  <th className="px-4 py-3 whitespace-nowrap sticky top-0 z-20 bg-[#F9F9F9]">การกระทำ</th>
                  <th className="px-4 py-3 sticky top-0 z-20 bg-[#F9F9F9]">รายละเอียด</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr
                    key={log.id}
                    data-markable-id={log.id}
                    onClick={() => setMarkedId(log.id)}
                    className={`border-b border-[#EDEEEF] last:border-b-0 cursor-pointer ${markedId === log.id ? 'bg-slate-200' : 'bg-white hover:bg-slate-50'}`}
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-[12px] font-normal text-[#6F6F6F]">{formatThaiDateTimeShort(log.timestamp)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {(() => {
                        // `log.user` is a name snapshot taken at log time (see handleLogAudit), not
                        // a stored employee id, so the avatar is a best-effort lookup by current
                        // nickname/name — falls back to the plain initial-circle when nobody matches
                        // (e.g. the employee was later renamed or deleted).
                        const actor = employees.find((e) => (e.nickname || e.name) === log.user);
                        return (
                          <div className="flex items-center gap-2">
                            {actor?.avatar ? (
                              <img src={actor.avatar} alt="" className="w-6 h-6 rounded-full object-cover shrink-0 bg-slate-50 border border-slate-100" />
                            ) : (
                              <div
                                className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-[10px] shrink-0"
                                style={{ backgroundColor: getAvatarColor(log.user) }}
                              >
                                {log.user.trim().charAt(0).toUpperCase()}
                              </div>
                            )}
                            <span className="text-[13px] font-bold text-slate-900">{log.user}</span>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-[12px] font-normal text-[#6F6F6F]">{log.role}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="inline-block text-[11px] font-semibold text-[#FF6537] bg-[#FFF1EC] px-2 py-0.5 rounded-full">{log.action}</span>
                    </td>
                    <td className="px-4 py-3 text-[12px] font-normal text-[#6F6F6F]">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </>
      )}

      {/* Create employee modal */}
      {createPortal(
        <AnimatePresence>
          {showAddForm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                className="absolute inset-0 bg-black/15 backdrop-blur-sm"
                onClick={resetForm}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 space-y-4"
              >
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-800">เพิ่มพนักงานใหม่</h3>
                  <button type="button" onClick={resetForm} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X size={18} /></button>
                </div>

                <form onSubmit={handleCreate} className="space-y-4 text-xs">
                  {formError && (
                    <div className="bg-rose-50 border border-rose-100 text-rose-700 text-xs px-3 py-2 rounded-lg">
                      {formError}
                    </div>
                  )}

                  {/* Two columns from sm up (same as the employee detail/edit modal) so the whole form
                      fits on screen instead of one long scrolling column. */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                    <div>
                      <label className="block text-[#272220] font-bold text-[11px] mb-1">ชื่อ-นามสกุล *</label>
                      <input
                        type="text"
                        required
                        autoFocus
                        placeholder="เช่น กิตตินันท์ ทิพย์รักษา"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#FF6537]"
                      />
                    </div>
                    <div>
                      <label className="block text-[#272220] font-bold text-[11px] mb-1">ชื่อเล่น <span className="font-normal text-slate-400">(ไม่บังคับ)</span></label>
                      <input
                        type="text"
                        placeholder={newName || 'เหมือนชื่อ-นามสกุล'}
                        value={newNickname}
                        onChange={(e) => setNewNickname(e.target.value)}
                        className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#FF6537]"
                      />
                    </div>

                    <div>
                      <label className="block text-[#272220] font-bold text-[11px] mb-1">อีเมล *</label>
                      <input
                        type="email"
                        required
                        placeholder="name@company.com"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#FF6537]"
                      />
                    </div>
                    <div>
                      <label className="block text-[#272220] font-bold text-[11px] mb-1">เบอร์โทร <span className="font-normal text-slate-400">(ไม่บังคับ)</span></label>
                      <input
                        type="tel"
                        inputMode="numeric"
                        placeholder="เช่น 0812345678"
                        value={newPhone}
                        onChange={(e) => setNewPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#FF6537]"
                      />
                    </div>

                    <div>
                      <label className="block text-[#272220] font-bold text-[11px] mb-1">Username *</label>
                      <input
                        type="text"
                        required
                        placeholder="เช่น ADW001"
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#FF6537]"
                      />
                    </div>
                    <div>
                      <label className="block text-[#272220] font-bold text-[11px] mb-1">รหัสผ่านเริ่มต้น *</label>
                      <input
                        type="text"
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#FF6537]"
                      />
                    </div>

                    <div>
                      <label className="block text-[#272220] font-bold text-[11px] mb-1">ตำแหน่ง *</label>
                      <RoleField
                        value={newRole}
                        onChange={(v) => {
                          setNewRole(v);
                          // Keep "ประเภทผู้ใช้งาน" in sync with "ตำแหน่ง" when it's set to ผู้บริหาร —
                          // same reasoning as EmployeeProfileModal's edit form. Gated the same way: a
                          // plain admin can't assign 'executive' anyway (assignableAccountTypes),
                          // so this never grants a level the actor couldn't pick directly.
                          if (v.trim() === 'ผู้บริหาร' && assignableAccountTypes(actingUser).includes('executive')) {
                            setNewAccountType('executive');
                          }
                        }}
                        roleOptions={roleOptions}
                      />
                    </div>
                    <div>
                      <label className="block text-[#272220] font-bold text-[11px] mb-1">ฝ่าย *</label>
                      <Dropdown<Division>
                        value={newDivision}
                        onChange={(v) => { setNewDivision(v); setNewDepartment(getSectionsForDivision(v)[0] ?? ''); }}
                        size="compact"
                        options={orgDivisions.map((d) => ({ value: d.name, label: d.name }))}
                      />
                    </div>

                    {!hidesDepartmentField && (
                    <div>
                      <label className="block text-[#272220] font-bold text-[11px] mb-1">แผนก *</label>
                      <Dropdown<string>
                        value={newDepartment}
                        onChange={setNewDepartment}
                        size="compact"
                        options={getSectionsForDivision(newDivision).map((d) => ({ value: d, label: d }))}
                      />
                    </div>
                    )}
                    <div>
                      <label className="block text-[#272220] font-bold text-[11px] mb-1">ประเภทผู้ใช้งาน *</label>
                      <Dropdown<AccountType>
                        value={newAccountType}
                        onChange={(v) => {
                          setNewAccountType(v);
                          // Drop any restriction that no longer applies to the newly-selected type
                          // (e.g. "จัดการพนักงาน" stops being a meaningful restriction once the type
                          // itself can no longer reach that menu at all).
                          setNewRestrictedMenuIds((prev) => prev.filter((id) => isNavAllowedByRole({ accountType: v }, id)));
                        }}
                        size="compact"
                        options={assignableAccountTypes(actingUser).map((t) => ({ value: t, label: ACCOUNT_TYPE_LABELS[t] }))}
                      />
                      {(newAccountType === 'admin' || newAccountType === 'superadmin') && (
                        <p className="mt-1 text-[10px] text-slate-400">เปลี่ยน Username ของบัญชีนี้ในภายหลังไม่ได้</p>
                      )}
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[#272220] font-bold text-[11px] mb-1">จำกัดสิทธิเมนู <span className="font-normal text-slate-400">(ไม่บังคับ)</span></label>
                      <MenuRestrictionChecklist items={restrictableNavItemsFor(newAccountType)} selectedIds={newRestrictedMenuIds} onChange={setNewRestrictedMenuIds} />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[#272220] font-bold text-[11px] mb-1">
                        รูปโปรไฟล์ <span className="font-normal text-slate-400">(ไม่บังคับ, ไม่เกิน {formatFileSize(MAX_AVATAR_BYTES)})</span>
                      </label>
                      <div className="flex items-center gap-2.5">
                        {newAvatar.trim() ? (
                          <img src={newAvatar.trim()} alt="" className="w-9 h-9 rounded-full object-cover shrink-0 bg-slate-50 border border-slate-100" />
                        ) : (
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0"
                            style={{ backgroundColor: getAvatarColor(newName || '?') }}
                          >
                            {(newName.trim().charAt(0) || '?').toUpperCase()}
                          </div>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleNewAvatarFilePicked(e.target.files?.[0] || null)}
                          className="flex-1 min-w-0 text-xs file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-[#FFF1EC] file:text-[#FF6537] file:font-bold file:cursor-pointer cursor-pointer"
                        />
                        {newAvatar.trim() && (
                          <Tooltip content="ลบรูปโปรไฟล์">
                            <button
                              type="button"
                              onClick={() => setNewAvatar('')}
                              className="text-slate-400 hover:text-slate-600 cursor-pointer shrink-0"
                              aria-label="ลบรูปโปรไฟล์"
                            >
                              <X size={16} />
                            </button>
                          </Tooltip>
                        )}
                      </div>
                      {newAvatarFileError && <p className="text-red-500 mt-1">{newAvatarFileError}</p>}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button type="button" onClick={resetForm} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold cursor-pointer hover:bg-slate-50">ยกเลิก</button>
                    <button
                      type="submit"
                      disabled={!isFormValid || isSubmitting}
                      className={`px-5 py-2 rounded-lg text-xs font-bold transition-colors ${
                        isFormValid && !isSubmitting ? 'bg-[#FF6537] text-white hover:bg-[#e6572c] cursor-pointer' : 'bg-[#F68C6C] text-white cursor-not-allowed'
                      }`}
                    >
                      {isSubmitting ? 'กำลังสร้าง...' : 'สร้างบัญชี'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Employee profile modal — both "ดูรายละเอียด" and "แก้ไข" open this, just in a different
          initial mode; it owns all of its own view/edit form state. */}
      {profileModal && (() => {
        const targetEmployee = employees.find((e) => e.id === profileModal.employeeId);
        if (!targetEmployee) return null;
        return (
          <EmployeeProfileModal
            employee={targetEmployee}
            actingUser={actingUser}
            initialMode={profileModal.mode}
            canEdit={!isEditLockedForAdmin(targetEmployee)}
            roleOptions={roleOptions}
            orgDivisions={orgDivisions}
            getSectionsForDivision={getSectionsForDivision}
            auditLogs={auditLogs}
            onClose={() => setProfileModal(null)}
            onSave={onUpdateEmployee}
            onSaved={() => {
              setProfileSaveSuccess(true);
              setTimeout(() => setProfileSaveSuccess(false), 3000);
            }}
          />
        );
      })()}

      {/* Delete confirmation modal */}
      {createPortal(
        <AnimatePresence>
          {deleteTarget && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                className="absolute inset-0 bg-black/15 backdrop-blur-sm"
                onClick={closeDeleteModal}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4"
              >
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-800">ลบบัญชีพนักงาน</h3>
                  <button type="button" onClick={closeDeleteModal} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X size={18} /></button>
                </div>

                <p className="text-xs text-slate-600">
                  ยืนยันการลบบัญชี <span className="font-bold text-slate-800">"{deleteTarget.name}"</span> ออกจากระบบถาวร รวมถึงข้อมูล login ที่ใช้เข้าสู่ระบบ — ไม่สามารถกู้คืนได้
                </p>

                <div>
                  <label className="block text-[#272220] font-bold text-[11px] mb-1">
                    เหตุผลที่ลบ <span className="text-[#FF6537]">*</span>
                  </label>
                  <textarea
                    autoFocus
                    rows={2}
                    placeholder="ระบุเหตุผล..."
                    value={deleteReason}
                    onChange={(e) => setDeleteReason(e.target.value)}
                    className="w-full p-2.5 text-sm border border-[#E5E5E5] rounded-lg placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#FF6537]"
                  />
                </div>

                {deleteError && (
                  <div className="bg-rose-50 border border-rose-100 text-rose-700 text-xs px-3 py-2 rounded-lg">
                    {deleteError}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <button type="button" onClick={closeDeleteModal} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold cursor-pointer hover:bg-slate-50">ยกเลิก</button>
                  <button
                    onClick={confirmDelete}
                    disabled={isDeleting || !deleteReason.trim()}
                    className="px-5 py-2 rounded-lg text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isDeleting ? 'กำลังลบ...' : 'ลบถาวร'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Success toasts */}
      {createPortal(
        <AnimatePresence>
          {(addSuccessNotice || profileSaveSuccess) && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.2 }}
              className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white rounded-xl shadow-xl px-5 py-3.5 text-sm"
            >
              {addSuccessNotice ? 'สร้างบัญชีพนักงานสำเร็จแล้ว' : 'บันทึกข้อมูลสำเร็จแล้ว'}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
