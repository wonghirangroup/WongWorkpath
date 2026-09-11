import { useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { X, Pencil, Mail, AtSign, Phone, Calendar, ShieldCheck, FileText, FolderKanban, ListChecks, ChevronDown, ChevronRight } from 'lucide-react';
import { Employee, Division, AccountType, AuditLog } from '../types';
import { ApiError } from '../lib/api';
import { getAvatarColor } from '../lib/avatarColor';
import { ACCOUNT_TYPE_LABELS, isNavAllowedByRole } from '../lib/permissions';
import { useAppData } from '../context/AppDataContext';
import { OrgDivisionData } from '../data/orgStructure';
import Dropdown from './Dropdown';
import {
  RoleField,
  MenuRestrictionChecklist,
  assignableAccountTypes,
  restrictableNavItemsFor,
  readFileAsDataUrl,
  MAX_AVATAR_BYTES,
  formatFileSize,
} from './EmployeeFormShared';

type EmployeeUpdatePayload = Partial<Pick<Employee, 'name' | 'nickname' | 'role' | 'avatar' | 'department' | 'division' | 'username' | 'accountType' | 'restrictedMenuIds' | 'phone' | 'address'>> & { password?: string };

interface EmployeeProfileModalProps {
  employee: Employee;
  actingUser: Employee | undefined;
  initialMode: 'view' | 'edit';
  canEdit: boolean;
  roleOptions: string[];
  orgDivisions: OrgDivisionData[];
  getSectionsForDivision: (division: string) => string[];
  auditLogs: AuditLog[];
  onClose: () => void;
  onSave: (id: string, updates: EmployeeUpdatePayload) => Promise<void>;
  onSaved: () => void;
}

function formatThaiDate(value?: string) {
  if (!value) return '—';
  const parsed = new Date(value.replace(' ', 'T'));
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
}

// One "label on top, value or input below" row — the same shape reused for every field in
// ข้อมูลส่วนตัว so view/edit mode only ever differ in whether `children` (the input) renders.
function InfoRow({ label, value, editing, children }: { label: string; value: string; editing: boolean; children?: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-bold text-[#272220] mb-1">{label}</p>
      {editing ? children : <p className="text-[13px] text-[#6F6F6F] whitespace-pre-wrap">{value || '—'}</p>}
    </div>
  );
}

const fieldInputClass = 'w-full h-10 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#FF6537]';

// Full-screen profile view/edit — opened by both the "ดูรายละเอียด" and "แก้ไข" card icons in
// EmployeeManagement, just starting in a different `initialMode`. Owns all of its own form state
// so EmployeeManagement doesn't need ~15 edit-specific state variables any more.
export default function EmployeeProfileModal({
  employee,
  actingUser,
  initialMode,
  canEdit,
  roleOptions,
  orgDivisions,
  getSectionsForDivision,
  auditLogs,
  onClose,
  onSave,
  onSaved,
}: EmployeeProfileModalProps) {
  const { documents } = useAppData();

  const [mode, setMode] = useState<'view' | 'edit'>(initialMode);
  const [name, setName] = useState(employee.name);
  const [nickname, setNickname] = useState(employee.nickname || employee.name);
  const [username, setUsername] = useState(employee.username || '');
  const [phone, setPhone] = useState(employee.phone || '');
  const [address, setAddress] = useState(employee.address || '');
  const [role, setRole] = useState(employee.role);
  const [division, setDivision] = useState<Division>(employee.division || orgDivisions[0]?.name || '');
  const [department, setDepartment] = useState<string>(() => {
    const initialDivision = employee.division || orgDivisions[0]?.name || '';
    const sections = getSectionsForDivision(initialDivision);
    return sections.includes(employee.department) ? employee.department : sections[0] ?? '';
  });
  const [accountType, setAccountType] = useState<AccountType>(employee.accountType);
  const [restrictedMenuIds, setRestrictedMenuIds] = useState<string[]>(employee.restrictedMenuIds ?? []);
  const [avatar, setAvatar] = useState(employee.avatar || '');
  const [password, setPassword] = useState('');
  const [avatarFileError, setAvatarFileError] = useState('');
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [docsExpanded, setDocsExpanded] = useState(false);
  const [activityExpanded, setActivityExpanded] = useState(false);

  // Admin-like accounts (admin/superadmin) keep a fixed username — same rule the server enforces.
  const targetIsAdminLike = accountType === 'admin' || accountType === 'superadmin';
  const isFormValid = !!(name.trim() && nickname.trim() && username.trim() && role.trim());

  const startEdit = () => setMode('edit');

  const cancelEdit = () => {
    setName(employee.name);
    setNickname(employee.nickname || employee.name);
    setUsername(employee.username || '');
    setPhone(employee.phone || '');
    setAddress(employee.address || '');
    setRole(employee.role);
    const initialDivision = employee.division || orgDivisions[0]?.name || '';
    setDivision(initialDivision);
    const sections = getSectionsForDivision(initialDivision);
    setDepartment(sections.includes(employee.department) ? employee.department : sections[0] ?? '');
    setAccountType(employee.accountType);
    setRestrictedMenuIds(employee.restrictedMenuIds ?? []);
    setAvatar(employee.avatar || '');
    setPassword('');
    setAvatarFileError('');
    setFormError('');
    setMode('view');
  };

  const handleAvatarFilePicked = async (file: globalThis.File | null) => {
    setAvatarFileError('');
    if (!file) return;
    if (file.size > MAX_AVATAR_BYTES) {
      setAvatarFileError(`ไฟล์ใหญ่เกินไป (${formatFileSize(file.size)}) — อัปโหลดได้ไม่เกิน ${formatFileSize(MAX_AVATAR_BYTES)}`);
      return;
    }
    setAvatar(await readFileAsDataUrl(file));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || isSaving) return;
    setFormError('');
    setIsSaving(true);
    try {
      await onSave(employee.id, {
        name: name.trim(),
        nickname: nickname.trim(),
        ...(targetIsAdminLike ? {} : { username: username.trim() }),
        ...(password.trim() ? { password: password.trim() } : {}),
        role: role.trim(),
        department,
        division,
        avatar: avatar.trim(),
        accountType,
        restrictedMenuIds,
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
      });
      setPassword('');
      setMode('view');
      onSaved();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSaving(false);
    }
  };

  // "เอกสารทั้งหมด" — documents this employee actually created (a doc's first history entry is
  // its creator; `updatedBy` on the doc itself tracks only the *last* editor) — mirrors the
  // `creatorName` logic DocVault.tsx already uses for its own "created by" display.
  const ownedDocs = documents.filter((doc) => {
    if (doc.kind === 'folder') return false;
    const creatorName = doc.history[0]?.updatedBy ?? doc.updatedBy;
    return creatorName === employee.name;
  });

  // "กิจกรรมล่าสุด" — matches handleLogAudit's own actor-name precedence (nickname first, see
  // AppDataContext.tsx) so this lines up exactly with what got logged for this person's actions.
  const employeeLogs = auditLogs
    .filter((log) => log.user === (employee.nickname || employee.name))
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const visibleLogs = activityExpanded ? employeeLogs : employeeLogs.slice(0, 5);

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          className="absolute inset-0 bg-black/25 backdrop-blur-sm"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.2 }}
          className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
        >
          <form onSubmit={handleSave}>
            <div className="p-6 space-y-6">
              {/* Header: avatar + name/role, edit toggle, close */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="relative shrink-0">
                    {avatar.trim() ? (
                      <img src={avatar.trim()} alt="" className="w-20 h-20 rounded-full object-cover bg-slate-50 border border-slate-100" />
                    ) : (
                      <div
                        className="w-20 h-20 rounded-full flex items-center justify-center text-white font-bold text-2xl"
                        style={{ backgroundColor: getAvatarColor(name || '?') }}
                      >
                        {(name.trim().charAt(0) || '?').toUpperCase()}
                      </div>
                    )}
                    {mode === 'edit' && (
                      <label className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white border border-slate-200 shadow flex items-center justify-center cursor-pointer hover:bg-slate-50">
                        <Pencil size={12} className="text-slate-500" />
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleAvatarFilePicked(e.target.files?.[0] || null)} />
                      </label>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-xl font-bold text-[#272220] truncate">{employee.nickname || employee.name}</h2>
                    <p className="text-sm font-semibold text-[#FF6537] truncate">{employee.role}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {mode === 'view' && canEdit && (
                    <button
                      type="button"
                      onClick={startEdit}
                      className="flex items-center gap-1.5 px-3.5 h-9 rounded-xl border border-[#FF6537] text-[#FF6537] text-xs font-bold cursor-pointer hover:bg-[#FFF1EC]"
                    >
                      <Pencil size={13} /> แก้ไขข้อมูล
                    </button>
                  )}
                  <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X size={20} /></button>
                </div>
              </div>

              {formError && (
                <div className="bg-rose-50 border border-rose-100 text-rose-700 text-xs px-3 py-2 rounded-lg">{formError}</div>
              )}
              {avatarFileError && <p className="text-xs text-red-500">{avatarFileError}</p>}

              {/* Contact strip — always reflects the last-saved record, editable fields live below */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 pb-5 border-b border-slate-100 text-[13px]">
                <div className="flex items-center gap-2 text-[#6F6F6F] min-w-0"><Mail size={14} className="shrink-0" /><span className="truncate">{employee.email}</span></div>
                <div className="flex items-center gap-2 text-[#6F6F6F] min-w-0"><AtSign size={14} className="shrink-0" /><span className="truncate">{employee.username || '—'}</span></div>
                <div className="flex items-center gap-2 text-[#6F6F6F] min-w-0"><Phone size={14} className="shrink-0" /><span className="truncate">{employee.phone || '—'}</span></div>
                <div className="flex items-center gap-2 text-[#6F6F6F] min-w-0"><Calendar size={14} className="shrink-0" /><span className="truncate">เข้าร่วมเมื่อ {formatThaiDate(employee.createdAt)}</span></div>
                <div className="flex items-center gap-2 text-[#6F6F6F] sm:col-span-2">
                  <ShieldCheck size={14} className="shrink-0" />
                  สิทธิ์การใช้งาน: <span className="font-semibold text-[#272220]">{ACCOUNT_TYPE_LABELS[employee.accountType]}</span>
                </div>
              </div>

              {/* ข้อมูลส่วนตัว + สถิติการใช้งาน */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-[#272220]">ข้อมูลส่วนตัว</h3>

                  {/* Paired two-per-row like the create form — keeps this column's height in the
                      same ballpark as the stat grid on the right instead of towering over it. */}
                  <div className="grid grid-cols-2 gap-3">
                    <InfoRow label="ชื่อ-นามสกุล" value={name} editing={mode === 'edit'}>
                      <input required autoFocus value={name} onChange={(e) => setName(e.target.value)} className={fieldInputClass} />
                    </InfoRow>
                    <InfoRow label="ชื่อเล่น" value={nickname} editing={mode === 'edit'}>
                      <input required value={nickname} onChange={(e) => setNickname(e.target.value)} className={fieldInputClass} />
                    </InfoRow>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <InfoRow label="Username" value={username} editing={mode === 'edit'}>
                      <input
                        required
                        disabled={targetIsAdminLike}
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className={`${fieldInputClass} ${targetIsAdminLike ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : ''}`}
                      />
                      {targetIsAdminLike && (
                        <p className="text-[10px] text-slate-400 mt-1">ไม่สามารถเปลี่ยน Username ของบัญชี Admin/Super Admin ได้</p>
                      )}
                    </InfoRow>
                    <InfoRow label="เบอร์โทร" value={phone} editing={mode === 'edit'}>
                      <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="เช่น 081-234-5678" className={fieldInputClass} />
                    </InfoRow>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <InfoRow label="ตำแหน่ง" value={role} editing={mode === 'edit'}>
                      <RoleField value={role} onChange={setRole} roleOptions={roleOptions} />
                    </InfoRow>
                    <InfoRow label="ฝ่าย" value={division} editing={mode === 'edit'}>
                      <Dropdown<Division>
                        value={division}
                        onChange={(v) => { setDivision(v); setDepartment(getSectionsForDivision(v)[0] ?? ''); }}
                        options={orgDivisions.map((d) => ({ value: d.name, label: d.name }))}
                      />
                    </InfoRow>
                  </div>

                  <InfoRow label="แผนก" value={department} editing={mode === 'edit'}>
                    <Dropdown<string>
                      value={department}
                      onChange={setDepartment}
                      options={getSectionsForDivision(division).map((d) => ({ value: d, label: d }))}
                    />
                  </InfoRow>

                  <InfoRow label="ที่อยู่" value={address} editing={mode === 'edit'}>
                    <textarea
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      rows={2}
                      placeholder="ที่อยู่ปัจจุบัน"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#FF6537] resize-none"
                    />
                  </InfoRow>
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-[#272220]">สถิติการใช้งาน</h3>

                  {/* โครงการทั้งหมด/งานทั้งหมด: shown as muted placeholders, not omitted outright —
                      the "จัดการงานและโครงการ" module is still local mock data with nothing
                      durable to count from yet, so these stay un-clickable until that's wired up. */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl border border-slate-100 bg-slate-50 opacity-70">
                      <div className="w-9 h-9 rounded-lg bg-slate-200 text-slate-400 flex items-center justify-center mb-2"><FolderKanban size={16} /></div>
                      <p className="text-lg font-bold text-slate-300 leading-none">—</p>
                      <p className="text-[11px] text-[#6F6F6F] mt-0.5">โครงการทั้งหมด</p>
                      <p className="text-[9px] text-slate-400 mt-1">เร็วๆ นี้</p>
                    </div>
                    <div className="p-3 rounded-xl border border-slate-100 bg-slate-50 opacity-70">
                      <div className="w-9 h-9 rounded-lg bg-slate-200 text-slate-400 flex items-center justify-center mb-2"><ListChecks size={16} /></div>
                      <p className="text-lg font-bold text-slate-300 leading-none">—</p>
                      <p className="text-[11px] text-[#6F6F6F] mt-0.5">งานทั้งหมด</p>
                      <p className="text-[9px] text-slate-400 mt-1">เร็วๆ นี้</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setDocsExpanded((v) => !v)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50 hover:bg-slate-100 cursor-pointer text-left"
                  >
                    <div className="w-9 h-9 rounded-lg bg-[#FFF1EC] text-[#FF6537] flex items-center justify-center shrink-0"><FileText size={16} /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-lg font-bold text-[#272220] leading-none">{ownedDocs.length}</p>
                      <p className="text-[11px] text-[#6F6F6F] mt-0.5">เอกสารทั้งหมด</p>
                    </div>
                    {docsExpanded ? <ChevronDown size={16} className="text-slate-400 shrink-0" /> : <ChevronRight size={16} className="text-slate-400 shrink-0" />}
                  </button>

                  {docsExpanded && (
                    <div className="pl-2 space-y-1 max-h-40 overflow-y-auto">
                      {ownedDocs.length === 0 ? (
                        <p className="text-xs text-slate-400">ยังไม่มีเอกสาร</p>
                      ) : ownedDocs.map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between gap-2 text-xs text-[#6F6F6F] py-1 border-b border-slate-50 last:border-0">
                          <span className="truncate">{doc.name}</span>
                          <span className="shrink-0 text-slate-400">{doc.lastUpdated}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* กิจกรรมล่าสุด */}
              <div className="pt-5 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[#272220]">กิจกรรมล่าสุด</h3>
                  {employeeLogs.length > 5 && (
                    <button
                      type="button"
                      onClick={() => setActivityExpanded((v) => !v)}
                      className="text-xs text-[#FF6537] font-semibold cursor-pointer hover:underline"
                    >
                      {activityExpanded ? 'ย่อ' : 'ดูทั้งหมด'}
                    </button>
                  )}
                </div>
                {visibleLogs.length === 0 ? (
                  <p className="text-xs text-slate-400">ยังไม่มีกิจกรรม</p>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {visibleLogs.map((log) => (
                      <div key={log.id} className="flex items-start gap-2 text-xs">
                        <span className="inline-block text-[10px] font-semibold text-[#FF6537] bg-[#FFF1EC] px-1.5 py-0.5 rounded-full shrink-0 mt-0.5 whitespace-nowrap">{log.action}</span>
                        <span className="flex-1 min-w-0 text-[#6F6F6F]">{log.details}</span>
                        <span className="shrink-0 text-slate-400 whitespace-nowrap">{log.timestamp}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Admin-only controls — only meaningful (and only shown) while editing */}
              {mode === 'edit' && (
                <div className="pt-5 border-t border-slate-100 space-y-3">
                  <h3 className="text-sm font-bold text-[#272220]">การจัดการสิทธิ์</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[#272220] font-bold text-[11px] mb-1">ประเภทผู้ใช้งาน *</label>
                      <Dropdown<AccountType>
                        value={accountType}
                        onChange={(v) => {
                          setAccountType(v);
                          setRestrictedMenuIds((prev) => prev.filter((id) => isNavAllowedByRole({ accountType: v }, id)));
                        }}
                        options={assignableAccountTypes(actingUser).map((t) => ({ value: t, label: ACCOUNT_TYPE_LABELS[t] }))}
                      />
                    </div>
                    <div>
                      <label className="block text-[#272220] font-bold text-[11px] mb-1">รหัสผ่านใหม่ <span className="font-normal text-slate-400">(เว้นว่างถ้าไม่เปลี่ยน)</span></label>
                      <input
                        type="text"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={fieldInputClass}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[#272220] font-bold text-[11px] mb-1">จำกัดสิทธิเมนู <span className="font-normal text-slate-400">(ไม่บังคับ)</span></label>
                    <MenuRestrictionChecklist items={restrictableNavItemsFor(accountType)} selectedIds={restrictedMenuIds} onChange={setRestrictedMenuIds} />
                  </div>
                </div>
              )}
            </div>

            {mode === 'edit' && (
              <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl sticky bottom-0">
                <button type="button" onClick={cancelEdit} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold cursor-pointer hover:bg-white">ยกเลิก</button>
                <button
                  type="submit"
                  disabled={!isFormValid || isSaving}
                  className={`px-5 py-2 rounded-lg text-xs font-bold transition-colors ${
                    isFormValid && !isSaving ? 'bg-[#FF6537] text-white hover:bg-[#e6572c] cursor-pointer' : 'bg-[#F68C6C] text-white cursor-not-allowed'
                  }`}
                >
                  {isSaving ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
              </div>
            )}
          </form>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
