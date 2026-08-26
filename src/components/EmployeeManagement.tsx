import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Plus, X, Search, Mail, Briefcase, MoreHorizontal, Pencil, Trash2, AtSign, ScrollText } from 'lucide-react';
import { Employee, Department, AuditLog } from '../types';
import { ApiError } from '../lib/api';
import Dropdown from './Dropdown';

const DEPARTMENT_OPTIONS: Department[] = ['IT', 'HR', 'Marketing', 'Sales', 'Design', 'Finance'];

const DEPARTMENT_TAG_COLORS: Record<Department, string> = {
  IT: 'text-blue-700 bg-blue-100',
  HR: 'text-fuchsia-700 bg-fuchsia-100',
  Marketing: 'text-orange-700 bg-orange-100',
  Sales: 'text-emerald-700 bg-emerald-100',
  Design: 'text-purple-700 bg-purple-100',
  Finance: 'text-slate-700 bg-slate-200'
};

const AVATAR_COLORS = ['#6366F1', '#EC4899', '#10B981', '#F59E0B', '#3B82F6', '#8B5CF6', '#EF4444', '#14B8A6'];
function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

const DEFAULT_PASSWORD = 'Wongwork2026!';

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function readFileAsDataUrl(file: globalThis.File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

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

const ADD_NEW_ROLE = '__add_new_role__';

// ตำแหน่ง picker: a dropdown built from every role already in use, plus an "add new" entry
// that swaps in a free-text input — so admins reuse existing job titles by default but can
// still introduce a brand-new one without leaving the form.
function RoleField({ value, onChange, roleOptions }: { value: string; onChange: (v: string) => void; roleOptions: string[] }) {
  const [isCustom, setIsCustom] = useState(() => value !== '' && !roleOptions.includes(value));

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
        ...roleOptions.map((r) => ({ value: r, label: r })),
        { value: ADD_NEW_ROLE, label: '+ เพิ่มตำแหน่งใหม่' }
      ]}
    />
  );
}

function EmployeeCardMenu({ onEdit, onDelete, deleteDisabled }: { onEdit: () => void; onDelete: () => void; deleteDisabled: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
      >
        <MoreHorizontal size={16} />
      </button>
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-20 text-left">
          <button
            onClick={() => { setIsOpen(false); onEdit(); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            <Pencil size={13} /> แก้ไข
          </button>
          {!deleteDisabled && (
            <button
              onClick={() => { setIsOpen(false); onDelete(); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 cursor-pointer"
            >
              <Trash2 size={13} /> ลบ
            </button>
          )}
        </div>
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
    updates: Partial<Pick<Employee, 'name' | 'nickname' | 'role' | 'avatar' | 'department' | 'username'>> & { password?: string }
  ) => Promise<void>;
  onDeleteEmployee: (id: string) => Promise<void>;
}

export default function EmployeeManagement({ employees, auditLogs, currentUserId, onAddEmployee, onUpdateEmployee, onDeleteEmployee }: EmployeeManagementProps) {
  const [activeTab, setActiveTab] = useState<'employees' | 'logs'>('employees');
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<Department | '__all__'>('__all__');
  const [logSearchTerm, setLogSearchTerm] = useState('');

  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newNickname, setNewNickname] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newDepartment, setNewDepartment] = useState<Department>('IT');
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [newPassword, setNewPassword] = useState(DEFAULT_PASSWORD);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addSuccessNotice, setAddSuccessNotice] = useState(false);

  // Edit modal — admin can change everything about an account, including resetting its login
  // (username/password). Password is left blank by default; only sent through if the admin
  // actually types a new one, so a normal edit doesn't accidentally reset someone's password.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editNickname, setEditNickname] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editIsAdmin, setEditIsAdmin] = useState(false);
  const [editPassword, setEditPassword] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editDepartment, setEditDepartment] = useState<Department>('IT');
  const [editAvatar, setEditAvatar] = useState('');
  const [avatarFileError, setAvatarFileError] = useState('');
  const [editFormError, setEditFormError] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editSuccessNotice, setEditSuccessNotice] = useState(false);

  const openEdit = (emp: Employee) => {
    setEditingId(emp.id);
    setEditName(emp.name);
    setEditNickname(emp.nickname || emp.name);
    setEditUsername(emp.username || '');
    setEditIsAdmin(!!emp.isAdmin);
    setEditPassword('');
    setEditRole(emp.role);
    setEditDepartment(emp.department);
    setEditAvatar(emp.avatar || '');
    setAvatarFileError('');
    setEditFormError('');
  };

  const handleAvatarFilePicked = async (file: globalThis.File | null) => {
    setAvatarFileError('');
    if (!file) return;
    if (file.size > MAX_AVATAR_BYTES) {
      setAvatarFileError(`ไฟล์ใหญ่เกินไป (${formatFileSize(file.size)}) — อัปโหลดได้ไม่เกิน ${formatFileSize(MAX_AVATAR_BYTES)}`);
      return;
    }
    setEditAvatar(await readFileAsDataUrl(file));
  };

  const closeEdit = () => setEditingId(null);

  const isEditFormValid = !!(
    editName.trim() && editNickname.trim() && editUsername.trim() && editRole.trim()
  );

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId || !isEditFormValid || isSavingEdit) return;
    setEditFormError('');
    setIsSavingEdit(true);
    try {
      await onUpdateEmployee(editingId, {
        name: editName.trim(),
        nickname: editNickname.trim(),
        ...(editIsAdmin ? {} : { username: editUsername.trim() }),
        ...(editPassword.trim() ? { password: editPassword.trim() } : {}),
        role: editRole.trim(),
        department: editDepartment,
        avatar: editAvatar.trim()
      });
      closeEdit();
      setEditSuccessNotice(true);
      setTimeout(() => setEditSuccessNotice(false), 3000);
    } catch (err) {
      setEditFormError(err instanceof ApiError ? err.message : 'บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError('');
    try {
      await onDeleteEmployee(deleteTarget.id);
      setDeleteTarget(null);
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
    setNewUsername('');
    setNewRole('');
    setNewDepartment('IT');
    setNewIsAdmin(false);
    setNewPassword(DEFAULT_PASSWORD);
    setFormError('');
    setShowAddForm(false);
  };

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
        username: newUsername.trim(),
        role: newRole.trim(),
        department: newDepartment,
        avatar: '',
        isAdmin: newIsAdmin,
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

  const filteredLogs = auditLogs.filter((log) => {
    const query = logSearchTerm.trim().toLowerCase();
    return !query
      || log.user.toLowerCase().includes(query)
      || log.action.toLowerCase().includes(query)
      || log.details.toLowerCase().includes(query);
  });

  return (
    <div className="space-y-6" id="employee-management-tab">
      <div className="flex items-center gap-0.5 bg-[#F4F4F5] rounded-xl p-1 w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('employees')}
          className={`flex items-center gap-1.5 px-3.5 h-8 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
            activeTab === 'employees' ? 'bg-white shadow-sm text-[#272220]' : 'text-[#6F6F6F] hover:text-[#272220]'
          }`}
        >
          <Briefcase size={13} /> รายชื่อพนักงาน
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('logs')}
          className={`flex items-center gap-1.5 px-3.5 h-8 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
            activeTab === 'logs' ? 'bg-white shadow-sm text-[#272220]' : 'text-[#6F6F6F] hover:text-[#272220]'
          }`}
        >
          <ScrollText size={13} /> บันทึกกิจกรรม (Log)
        </button>
      </div>

      {activeTab === 'employees' ? (
      <>
      <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
        <div className="relative w-full lg:w-137.5 lg:flex-none">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ค้นหาพนักงาน (ชื่อ / อีเมล)"
            className="w-full h-10 pl-9 pr-9 bg-[#F6F6F8] border border-transparent rounded-xl text-[13px] font-normal focus:outline-none focus:border-[#FF6537]"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              title="ล้างคำค้นหา"
            >
              <X size={15} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-36 h-10">
            <Dropdown<Department | '__all__'>
              value={departmentFilter}
              onChange={setDepartmentFilter}
              options={[
                { value: '__all__', label: 'ทุกแผนก' },
                ...DEPARTMENT_OPTIONS.map((d) => ({ value: d, label: d }))
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

      <p className="font-normal text-[16px] text-[#6F6F6F] leading-none">ทั้งหมด {filteredEmployees.length} คน</p>

      {filteredEmployees.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-2xl p-10 text-center text-slate-400 text-sm">
          {employees.length === 0 ? 'ยังไม่มีพนักงานในระบบ' : 'ไม่พบรายการที่ตรงกับการค้นหา'}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredEmployees.map((emp) => (
            <div
              key={emp.id}
              className="bg-white shadow-[0px_2px_7px_-1px_rgba(0,0,0,0.1)] p-4 rounded-2xl space-y-3"
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
                  <h4 className="text-[15px] font-bold text-[#272220] truncate">{emp.nickname || emp.name}</h4>
                  {emp.nickname && emp.nickname !== emp.name && (
                    <p className="text-[11px] text-slate-400 truncate">{emp.name}</p>
                  )}
                  <span className={`inline-block text-[9px] font-semibold px-1.5 py-0.5 rounded-full leading-none ${DEPARTMENT_TAG_COLORS[emp.department]}`}>
                    {emp.department}
                  </span>
                </div>
                <EmployeeCardMenu
                  onEdit={() => openEdit(emp)}
                  onDelete={() => setDeleteTarget({ id: emp.id, name: emp.name })}
                  deleteDisabled={emp.id === currentUserId}
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
      )}
      </>
      ) : (
      <>
        <div className="relative w-full lg:w-137.5">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={logSearchTerm}
            onChange={(e) => setLogSearchTerm(e.target.value)}
            placeholder="ค้นหา Log (ผู้ใช้ / การกระทำ / รายละเอียด)"
            className="w-full h-10 pl-9 pr-9 bg-[#F6F6F8] border border-transparent rounded-xl text-[13px] font-normal focus:outline-none focus:border-[#FF6537]"
          />
          {logSearchTerm && (
            <button
              type="button"
              onClick={() => setLogSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              title="ล้างคำค้นหา"
            >
              <X size={15} />
            </button>
          )}
        </div>

        <p className="font-normal text-[16px] text-[#6F6F6F] leading-none">ทั้งหมด {filteredLogs.length} รายการ</p>

        {filteredLogs.length === 0 ? (
          <div className="bg-white border border-slate-100 rounded-2xl p-10 text-center text-slate-400 text-sm">
            {auditLogs.length === 0 ? 'ยังไม่มีบันทึกกิจกรรม' : 'ไม่พบรายการที่ตรงกับการค้นหา'}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-[0px_2px_7px_-1px_rgba(0,0,0,0.1)] overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F9F9F9] text-[12px] font-semibold text-[#000000] border-b border-[#EDEEEF]">
                  <th className="px-4 py-3 whitespace-nowrap">เวลา</th>
                  <th className="px-4 py-3 whitespace-nowrap">ผู้ใช้</th>
                  <th className="px-4 py-3 whitespace-nowrap">ตำแหน่ง</th>
                  <th className="px-4 py-3 whitespace-nowrap">การกระทำ</th>
                  <th className="px-4 py-3">รายละเอียด</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="bg-white border-b border-[#EDEEEF] last:border-b-0 hover:bg-slate-50">
                    <td className="px-4 py-3 whitespace-nowrap text-[12px] font-normal text-[#6F6F6F]">{log.timestamp}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-[13px] font-bold text-slate-900">{log.user}</td>
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
                className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto p-5 space-y-4"
              >
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-800">เพิ่มพนักงานใหม่</h3>
                  <button type="button" onClick={resetForm} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X size={18} /></button>
                </div>

                <form onSubmit={handleCreate} className="space-y-3 text-xs">
                  {formError && (
                    <div className="bg-rose-50 border border-rose-100 text-rose-700 text-xs px-3 py-2 rounded-lg">
                      {formError}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
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

                  <div className="grid grid-cols-2 gap-3">
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
                  </div>

                  <div>
                    <label className="block text-[#272220] font-bold text-[11px] mb-1">ตำแหน่ง *</label>
                    <RoleField value={newRole} onChange={setNewRole} roleOptions={roleOptions} />
                  </div>

                  <div>
                    <label className="block text-[#272220] font-bold text-[11px] mb-1">แผนก *</label>
                    <Dropdown<Department>
                      value={newDepartment}
                      onChange={setNewDepartment}
                      size="compact"
                      options={DEPARTMENT_OPTIONS.map((d) => ({ value: d, label: d }))}
                    />
                  </div>

                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newIsAdmin}
                      onChange={(e) => setNewIsAdmin(e.target.checked)}
                      className="mt-0.5 w-3.5 h-3.5 accent-[#FF6537] cursor-pointer"
                    />
                    <span>
                      <span className="block text-[#272220] font-bold text-[11px]">ตั้งเป็น Admin</span>
                      <span className="block text-[10px] text-slate-400">เข้าถึงหน้าจัดการพนักงานได้ และเปลี่ยน Username ของบัญชีนี้ในภายหลังไม่ได้</span>
                    </span>
                  </label>

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

      {/* Edit employee modal */}
      {createPortal(
        <AnimatePresence>
          {editingId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                className="absolute inset-0 bg-black/15 backdrop-blur-sm"
                onClick={closeEdit}
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
                className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 space-y-4"
              >
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-800">แก้ไขข้อมูลพนักงาน</h3>
                  <button type="button" onClick={closeEdit} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X size={18} /></button>
                </div>

                <form onSubmit={handleSaveEdit} className="space-y-3 text-xs">
                  {editFormError && (
                    <div className="bg-rose-50 border border-rose-100 text-rose-700 text-xs px-3 py-2 rounded-lg">
                      {editFormError}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[#272220] font-bold text-[11px] mb-1">ชื่อ-นามสกุล *</label>
                      <input
                        type="text"
                        required
                        autoFocus
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#FF6537]"
                      />
                    </div>
                    <div>
                      <label className="block text-[#272220] font-bold text-[11px] mb-1">ชื่อเล่น *</label>
                      <input
                        type="text"
                        required
                        value={editNickname}
                        onChange={(e) => setEditNickname(e.target.value)}
                        className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#FF6537]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[#272220] font-bold text-[11px] mb-1">ตำแหน่ง *</label>
                    <RoleField value={editRole} onChange={setEditRole} roleOptions={roleOptions} />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[#272220] font-bold text-[11px] mb-1">Username *</label>
                      <input
                        type="text"
                        required
                        disabled={editIsAdmin}
                        value={editUsername}
                        onChange={(e) => setEditUsername(e.target.value)}
                        className={`w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#FF6537] ${editIsAdmin ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : ''}`}
                      />
                      {editIsAdmin && (
                        <p className="text-[10px] text-slate-400 mt-1">ไม่สามารถเปลี่ยน Username ของบัญชี Admin ได้</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-[#272220] font-bold text-[11px] mb-1">รหัสผ่านใหม่ <span className="font-normal text-slate-400">(เว้นว่างถ้าไม่เปลี่ยน)</span></label>
                      <input
                        type="text"
                        placeholder="••••••••"
                        value={editPassword}
                        onChange={(e) => setEditPassword(e.target.value)}
                        className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#FF6537]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[#272220] font-bold text-[11px] mb-1">แผนก *</label>
                    <Dropdown<Department>
                      value={editDepartment}
                      onChange={setEditDepartment}
                      size="compact"
                      options={DEPARTMENT_OPTIONS.map((d) => ({ value: d, label: d }))}
                    />
                  </div>

                  <div>
                    <label className="block text-[#272220] font-bold text-[11px] mb-1">
                      รูปโปรไฟล์ <span className="font-normal text-slate-400">(ไม่บังคับ, ไม่เกิน {formatFileSize(MAX_AVATAR_BYTES)})</span>
                    </label>
                    <div className="flex items-center gap-2.5">
                      {editAvatar.trim() ? (
                        <img src={editAvatar.trim()} alt="" className="w-9 h-9 rounded-full object-cover shrink-0 bg-slate-50 border border-slate-100" />
                      ) : (
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0"
                          style={{ backgroundColor: getAvatarColor(editName || '?') }}
                        >
                          {(editName.trim().charAt(0) || '?').toUpperCase()}
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleAvatarFilePicked(e.target.files?.[0] || null)}
                        className="flex-1 min-w-0 text-xs file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-[#FFF1EC] file:text-[#FF6537] file:font-bold file:cursor-pointer cursor-pointer"
                      />
                      {editAvatar.trim() && (
                        <button
                          type="button"
                          onClick={() => setEditAvatar('')}
                          className="text-slate-400 hover:text-slate-600 cursor-pointer shrink-0"
                          title="ลบรูปโปรไฟล์"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                    {avatarFileError && <p className="text-red-500 mt-1">{avatarFileError}</p>}
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button type="button" onClick={closeEdit} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold cursor-pointer hover:bg-slate-50">ยกเลิก</button>
                    <button
                      type="submit"
                      disabled={!isEditFormValid || isSavingEdit}
                      className={`px-5 py-2 rounded-lg text-xs font-bold transition-colors ${
                        isEditFormValid && !isSavingEdit ? 'bg-[#FF6537] text-white hover:bg-[#e6572c] cursor-pointer' : 'bg-[#F68C6C] text-white cursor-not-allowed'
                      }`}
                    >
                      {isSavingEdit ? 'กำลังบันทึก...' : 'บันทึก'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Delete confirmation modal */}
      {createPortal(
        <AnimatePresence>
          {deleteTarget && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                className="absolute inset-0 bg-black/15 backdrop-blur-sm"
                onClick={() => setDeleteTarget(null)}
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
                  <button type="button" onClick={() => setDeleteTarget(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X size={18} /></button>
                </div>

                <p className="text-xs text-slate-600">
                  ยืนยันการลบบัญชี <span className="font-bold text-slate-800">"{deleteTarget.name}"</span> ออกจากระบบถาวร รวมถึงข้อมูล login ที่ใช้เข้าสู่ระบบ — ไม่สามารถกู้คืนได้
                </p>

                {deleteError && (
                  <div className="bg-rose-50 border border-rose-100 text-rose-700 text-xs px-3 py-2 rounded-lg">
                    {deleteError}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <button type="button" onClick={() => setDeleteTarget(null)} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold cursor-pointer hover:bg-slate-50">ยกเลิก</button>
                  <button
                    onClick={confirmDelete}
                    disabled={isDeleting}
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
          {(addSuccessNotice || editSuccessNotice) && (
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
