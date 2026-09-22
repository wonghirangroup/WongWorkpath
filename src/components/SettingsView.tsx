import { useEffect, useRef, useState, FormEvent, ReactNode } from 'react';
import { Bell, Camera, Check, Clock, Eye, EyeOff, KeyRound, Pencil, ShieldCheck, User } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Employee, NOTIFICATION_CATEGORY_IDS, NotificationCategory } from '../types';
import { NOTIFICATION_CATEGORY_META } from '../lib/notificationCategories';
import { ApiError, ChangeRequest } from '../lib/api';
import { getAvatarColor } from '../lib/avatarColor';
import { canManageEmployees } from '../lib/permissions';
import { useConfirm } from '../context/ConfirmContext';
import { MAX_AVATAR_BYTES, formatFileSize, readFileAsDataUrl } from './EmployeeFormShared';
import ToggleSwitch from './ToggleSwitch';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;

interface SettingsViewProps {
  currentUser: Employee;
  changeRequests: ChangeRequest[];
  onUpdateEmployee: (
    id: string,
    updates: Partial<Pick<Employee, 'name' | 'nickname' | 'email' | 'avatar' | 'phone' | 'mutedNotificationCategories'>>
  ) => Promise<void>;
  onRequestChange: (
    entityType: 'project' | 'project_task' | 'employee',
    entityId: string,
    requestType: 'edit' | 'delete',
    proposedChanges: Record<string, unknown> | undefined,
    reason: string
  ) => Promise<void>;
  onChangePassword: (password: string) => Promise<void>;
  onRefresh: () => Promise<void>;
}

const INPUT_CLASS =
  'w-full h-11 px-3 text-sm text-[#272220] border border-[#E5E5E5] rounded-xl bg-white placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#FF6537] disabled:bg-[#F9F9F9] disabled:text-[#6F6F6F] disabled:cursor-not-allowed';

const CARD_CLASS = 'bg-white rounded-2xl border border-[#EDEEEF] shadow-[0px_2px_7px_-1px_rgba(0,0,0,0.1)]';

type SettingsSection = 'profile' | 'password' | 'notifications';

// The two zones from the spec — บัญชีของฉัน (โปรไฟล์, เปลี่ยนรหัสผ่าน) and การแจ้งเตือน — as the
// left menu; each entry opens its own form in the workspace on the right.
const MENU_GROUPS: { label: string; items: { id: SettingsSection; label: string; icon: LucideIcon }[] }[] = [
  {
    label: 'บัญชีของฉัน',
    items: [
      { id: 'profile', label: 'โปรไฟล์', icon: User },
      { id: 'password', label: 'เปลี่ยนรหัสผ่าน', icon: KeyRound },
    ],
  },
  {
    label: 'การแจ้งเตือน',
    items: [{ id: 'notifications', label: 'เปิด/ปิดการแจ้งเตือน', icon: Bell }],
  },
];

const SECTION_META: Record<SettingsSection, { title: string; description: string }> = {
  profile: { title: 'โปรไฟล์', description: 'รูป ชื่อ และช่องทางติดต่อของคุณที่แสดงในระบบ' },
  password: { title: 'เปลี่ยนรหัสผ่าน', description: `เปลี่ยนได้วันละ 1 ครั้ง · อย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร` },
  notifications: { title: 'การแจ้งเตือน', description: 'เปิด/ปิดทีละประเภท — ประเภทที่ปิดจะไม่แสดงในระบบ และกลับมาแสดงเมื่อเปิดอีกครั้ง' },
};

function Field({ label, htmlFor, error, children }: { label: string; htmlFor: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-[#272220] font-bold text-[11px] mb-1">{label}</label>
      {children}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

function PasswordInput({ id, value, onChange, show, onToggleShow, autoComplete = 'new-password' }: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggleShow: () => void;
  autoComplete?: string;
}) {
  return (
    <div className="relative">
      <input
        id={id}
        type={show ? 'text' : 'password'}
        autoComplete={autoComplete}
        placeholder="••••••••"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${INPUT_CLASS} pr-10`}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={onToggleShow}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
        aria-label={show ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

// "การตั้งค่า" — open to every account type. Two zones: บัญชีของฉัน (profile + password) and
// การแจ้งเตือน (one global on/off switch). name/nickname changes need an admin's approval for a
// plain employee (a change request, decided from Employee Management); admin-like accounts save
// those directly, same "the approver bypasses their own gate" rule as the project edit flow.
export default function SettingsView({ currentUser, changeRequests, onUpdateEmployee, onRequestChange, onChangePassword, onRefresh }: SettingsViewProps) {
  const confirm = useConfirm();
  const [section, setSection] = useState<SettingsSection>('profile');
  // The profile starts read-only; "แก้ไข" unlocks it, and saving asks for confirmation first.
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentNickname = currentUser.nickname || currentUser.name;
  const currentPhone = currentUser.phone ?? '';
  const currentAvatar = currentUser.avatar || '';
  const needsApprovalForNames = !canManageEmployees(currentUser);

  const pendingRequest = changeRequests.find(
    (r) => r.entityType === 'employee' && r.entityId === currentUser.id && r.status === 'pending'
  );
  const pendingChanges = (pendingRequest?.proposedChanges ?? {}) as { name?: string; nickname?: string };

  // ---- Profile draft ----
  const [name, setName] = useState(currentUser.name);
  const [nickname, setNickname] = useState(currentNickname);
  const [phone, setPhone] = useState(currentPhone);
  const [email, setEmail] = useState(currentUser.email ?? '');
  const [avatar, setAvatar] = useState(currentAvatar);
  const [reason, setReason] = useState('');
  const [avatarError, setAvatarError] = useState('');
  const [profileError, setProfileError] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState('');

  // Re-seed the draft whenever the saved values change underneath it (after a save, or once a
  // refresh brings in an admin-approved name) — keyed on the values themselves, not the object,
  // so unrelated context updates never wipe what someone is halfway through typing.
  const serverSnapshot = [currentUser.name, currentNickname, currentPhone, currentUser.email, currentAvatar].join('\u0000');
  useEffect(() => {
    setName(currentUser.name);
    setNickname(currentNickname);
    setPhone(currentPhone);
    setEmail(currentUser.email ?? '');
    setAvatar(currentAvatar);
    setReason('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverSnapshot]);

  // Approvals are decided on someone else's client — pull fresh data on open.
  useEffect(() => {
    onRefresh().catch((err) => console.warn('Could not refresh account data:', err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const savedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(savedTimer.current), []);
  const flashSaved = (message: string) => {
    setProfileSaved(message);
    clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setProfileSaved(''), 4000);
  };

  const nameChanged = name.trim() !== currentUser.name;
  const nicknameChanged = nickname.trim() !== currentNickname;
  const namesChanged = !pendingRequest && (nameChanged || nicknameChanged);
  const needsApproval = needsApprovalForNames && namesChanged;
  const phoneChanged = phone !== currentPhone;
  const emailChanged = email.trim().toLowerCase() !== (currentUser.email ?? '').toLowerCase();
  const avatarChanged = avatar !== currentAvatar;
  const isDirty = namesChanged || phoneChanged || emailChanged || avatarChanged;

  const emailError = email.trim() && !EMAIL_PATTERN.test(email.trim()) ? 'รูปแบบอีเมลไม่ถูกต้อง' : '';
  const phoneError = phone && phone.length !== 10 ? 'กรอกเบอร์โทรให้ครบ 10 หลัก' : '';
  const namesValid = Boolean(name.trim()) && Boolean(nickname.trim());
  const canSaveProfile =
    isDirty && namesValid && !emailError && !phoneError && (!needsApproval || reason.trim() !== '') && !isSavingProfile;

  const handleAvatarPicked = async (file: globalThis.File | null) => {
    setAvatarError('');
    if (!file) return;
    if (file.size > MAX_AVATAR_BYTES) {
      setAvatarError(`ไฟล์ใหญ่เกินไป (${formatFileSize(file.size)}) — อัปโหลดได้ไม่เกิน ${formatFileSize(MAX_AVATAR_BYTES)}`);
      return;
    }
    setAvatar(await readFileAsDataUrl(file));
  };

  const handleCancelEditProfile = () => {
    setName(currentUser.name);
    setNickname(currentNickname);
    setPhone(currentPhone);
    setEmail(currentUser.email ?? '');
    setAvatar(currentAvatar);
    setReason('');
    setAvatarError('');
    setProfileError('');
    setIsEditingProfile(false);
  };

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSaveProfile) return;

    const savedLabels = [
      avatarChanged && 'รูปโปรไฟล์',
      phoneChanged && 'เบอร์โทร',
      emailChanged && 'อีเมล',
      !needsApprovalForNames && nameChanged && 'ชื่อ-นามสกุล',
      !needsApprovalForNames && nicknameChanged && 'ชื่อเล่น',
    ].filter(Boolean) as string[];
    const requestedLabels = needsApproval ? [nameChanged && 'ชื่อ-นามสกุล', nicknameChanged && 'ชื่อเล่น'].filter(Boolean) as string[] : [];
    const confirmed = await confirm({
      title: savedLabels.length > 0 ? 'ยืนยันการบันทึกโปรไฟล์?' : 'ยืนยันการส่งคำขอเปลี่ยนชื่อ?',
      message: (
        <>
          {savedLabels.length > 0 && <>จะบันทึก: {savedLabels.join(', ')}</>}
          {savedLabels.length > 0 && requestedLabels.length > 0 && <br />}
          {requestedLabels.length > 0 && <>จะส่งคำขอให้แอดมินอนุมัติ: {requestedLabels.join(', ')}</>}
        </>
      ),
      confirmLabel: savedLabels.length > 0 ? 'บันทึก' : 'ส่งคำขอ',
    });
    if (!confirmed) return;

    setProfileError('');
    setProfileSaved('');
    setIsSavingProfile(true);

    const direct: Partial<Pick<Employee, 'name' | 'nickname' | 'email' | 'avatar' | 'phone'>> = {};
    if (avatarChanged) direct.avatar = avatar;
    if (phoneChanged) direct.phone = phone;
    if (emailChanged) direct.email = email.trim();
    if (!needsApprovalForNames) {
      if (nameChanged) direct.name = name.trim();
      if (nicknameChanged) direct.nickname = nickname.trim();
    }

    try {
      if (Object.keys(direct).length > 0) {
        await onUpdateEmployee(currentUser.id, direct);
      }
      if (needsApproval) {
        const proposed: Record<string, string> = {};
        if (nameChanged) proposed.name = name.trim();
        if (nicknameChanged) proposed.nickname = nickname.trim();
        await onRequestChange('employee', currentUser.id, 'edit', proposed, reason.trim());
        // The names on screen must stay the current ones until an admin approves.
        setName(currentUser.name);
        setNickname(currentNickname);
        setReason('');
        flashSaved('ส่งคำขอเปลี่ยนชื่อให้แอดมินแล้ว');
      } else {
        flashSaved('บันทึกแล้ว');
      }
      setIsEditingProfile(false);
    } catch (err) {
      setProfileError(err instanceof ApiError ? err.message : 'บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // ---- Password ----
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordDone, setPasswordDone] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  const passwordTooShort = newPassword !== '' && newPassword.length < MIN_PASSWORD_LENGTH;
  const passwordMismatch = confirmPassword !== '' && newPassword !== confirmPassword;
  const canSavePassword =
    newPassword.length >= MIN_PASSWORD_LENGTH && newPassword === confirmPassword && !isSavingPassword;

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSavePassword) return;
    const confirmed = await confirm({
      title: 'ยืนยันการเปลี่ยนรหัสผ่าน?',
      message: 'เปลี่ยนรหัสผ่านได้วันละ 1 ครั้ง หลังจากนี้จะเปลี่ยนอีกไม่ได้ภายใน 24 ชั่วโมง',
      confirmLabel: 'เปลี่ยนรหัสผ่าน',
    });
    if (!confirmed) return;
    setPasswordError('');
    setPasswordDone(false);
    setIsSavingPassword(true);
    try {
      await onChangePassword(newPassword);
      setNewPassword('');
      setConfirmPassword('');
      setShowNewPassword(false);
      setShowConfirmPassword(false);
      setPasswordDone(true);
    } catch (err) {
      setPasswordError(err instanceof ApiError ? err.message : 'เปลี่ยนรหัสผ่านไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSavingPassword(false);
    }
  };

  // ---- Notifications ----
  // A switch moves the instant it's clicked (optimistic) and the save runs behind it — waiting for
  // the server before moving, and dimming every switch while it did, read as a flicker. Saves go out
  // one at a time in click order, and clicks made while one is in flight collapse into the latest
  // list, so a slow earlier request can never overwrite a newer choice.
  const serverMuted = currentUser.mutedNotificationCategories ?? [];
  const serverMutedKey = [...serverMuted].sort().join(',');
  const [optimisticMuted, setOptimisticMuted] = useState<NotificationCategory[] | null>(null);
  const [syncTick, setSyncTick] = useState(0);
  const [notificationsError, setNotificationsError] = useState('');
  const desiredMuted = useRef<NotificationCategory[] | null>(null);
  const isSyncingMuted = useRef(false);
  const onUpdateEmployeeRef = useRef(onUpdateEmployee);
  onUpdateEmployeeRef.current = onUpdateEmployee;
  const mutedCategories = optimisticMuted ?? serverMuted;

  // Drop the optimistic copy only once the saved (context) state has caught up with it — clearing it
  // any earlier would flash the old value back for a frame.
  useEffect(() => {
    if (optimisticMuted === null || isSyncingMuted.current || desiredMuted.current !== null) return;
    const optimisticKey = [...optimisticMuted].sort().join(',');
    if (optimisticKey === serverMutedKey) setOptimisticMuted(null);
  }, [serverMutedKey, optimisticMuted, syncTick]);

  const syncMutedCategories = async () => {
    if (isSyncingMuted.current) return;
    isSyncingMuted.current = true;
    try {
      while (desiredMuted.current) {
        const toSend = desiredMuted.current;
        desiredMuted.current = null;
        try {
          await onUpdateEmployeeRef.current(currentUser.id, { mutedNotificationCategories: toSend });
        } catch (err) {
          desiredMuted.current = null;
          setOptimisticMuted(null);
          setNotificationsError(err instanceof ApiError ? err.message : 'บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
        }
      }
    } finally {
      isSyncingMuted.current = false;
      setSyncTick((t) => t + 1);
    }
  };

  const handleToggleCategory = (category: NotificationCategory, enabled: boolean) => {
    const next = enabled ? mutedCategories.filter((c) => c !== category) : [...new Set([...mutedCategories, category])];
    setNotificationsError('');
    setOptimisticMuted(next);
    desiredMuted.current = next;
    void syncMutedCategories();
  };

  const avatarInitial = currentUser.name.trim().charAt(0).toUpperCase();
  const meta = SECTION_META[section];

  return (
    <div className="flex flex-col lg:flex-row lg:items-stretch lg:min-h-full gap-4 lg:gap-6 pb-8 lg:pb-0" id="settings-page">
      {/* Menu Zone — one entry per setting, grouped under the two zones (บัญชีของฉัน / การแจ้งเตือน).
          On narrow screens the group labels drop away and the entries become a scrolling pill row.
          On desktop both cards stretch to the bottom of the content area (min-h-full above), which
          lands exactly on the Sidebar's own bottom edge — <main>'s lg:pb-4 matches its my-4. */}
      <nav
        aria-label="เมนูการตั้งค่า"
        className="lg:w-72 lg:shrink-0 lg:bg-white lg:rounded-2xl lg:border lg:border-[#EDEEEF] lg:shadow-[0px_2px_7px_-1px_rgba(0,0,0,0.1)] lg:p-3"
      >
        <div className="flex lg:flex-col gap-1 lg:gap-4 overflow-x-auto lg:overflow-visible pb-1 lg:pb-0">
          {MENU_GROUPS.map((group) => (
            <div key={group.label} className="contents lg:flex lg:flex-col lg:gap-0.5">
              <p className="hidden lg:block px-3 pt-1 pb-1 text-[11px] font-bold text-[#A0A0A0]">{group.label}</p>
              {group.items.map(({ id, label, icon: Icon }) => {
                const isActive = section === id;
                return (
                  <button
                    key={id}
                    type="button"
                    id={`settings-menu-${id}`}
                    onClick={() => setSection(id)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`flex items-center gap-2.5 h-11 px-3 rounded-xl text-sm font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                      isActive
                        ? 'bg-[#FF6537] text-white'
                        : 'text-[#6F6F6F] hover:text-[#272220] hover:bg-slate-50 max-lg:bg-white max-lg:border max-lg:border-slate-200'
                    }`}
                  >
                    <Icon size={17} className="shrink-0" />
                    <span className="flex-1 text-left">{label}</span>
                    {id === 'profile' && pendingRequest && (
                      <span className={`w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-white' : 'bg-amber-500'}`} role="img" aria-label="มีคำขอรออนุมัติ" />
                    )}
                    {id === 'notifications' && mutedCategories.length > 0 && (
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${isActive ? 'bg-white/25 text-white' : 'bg-[#F4F4F5] text-[#6F6F6F]'}`}>
                        ปิด {mutedCategories.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </nav>

      {/* Work Space — the selected entry's form. All drafts live in this component's state, so
          switching entries never loses what someone was halfway through typing. */}
      <section className={`${CARD_CLASS} w-full min-w-0 lg:flex-1`} aria-labelledby="settings-section-title">
        <div className="px-6 pt-6 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="settings-section-title" className="text-[15px] font-bold text-[#272220]">{meta.title}</h2>
            <p className="text-xs text-[#6F6F6F] mt-0.5">{meta.description}</p>
          </div>
          {section === 'profile' && !isEditingProfile && (
            <button
              type="button"
              id="settings-edit-profile"
              onClick={() => { setProfileSaved(''); setIsEditingProfile(true); }}
              className="flex items-center gap-1.5 px-3.5 h-9 rounded-xl border border-[#FF6537] text-[#FF6537] text-xs font-bold cursor-pointer hover:bg-[#FFF1EC] transition-colors shrink-0"
            >
              <Pencil size={13} /> แก้ไข
            </button>
          )}
        </div>

        {section === 'profile' && (
          <form onSubmit={handleSaveProfile} className="px-6 py-5 space-y-5" noValidate>
            <div className="flex items-center gap-4">
              {avatar ? (
                <img src={avatar} alt="" className="w-16 h-16 rounded-full object-cover bg-slate-50 border border-slate-100 shrink-0" />
              ) : (
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold shrink-0"
                  style={{ backgroundColor: getAvatarColor(currentUser.name) }}
                >
                  {avatarInitial}
                </div>
              )}
              {isEditingProfile && (
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 h-9 px-3.5 text-xs font-bold text-[#272220] border border-[#E5E5E5] rounded-xl hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <Camera size={14} />
                      เปลี่ยนรูป
                    </button>
                    {avatar && (
                      <button
                        type="button"
                        onClick={() => { setAvatar(''); setAvatarError(''); }}
                        className="h-9 px-3 text-xs font-semibold text-[#6F6F6F] hover:text-[#272220] cursor-pointer"
                      >
                        ลบรูป
                      </button>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => { handleAvatarPicked(e.target.files?.[0] || null); e.target.value = ''; }}
                    aria-label="เลือกรูปโปรไฟล์"
                  />
                  <p className="text-[11px] text-[#6F6F6F] mt-1.5">รูปภาพไม่เกิน {formatFileSize(MAX_AVATAR_BYTES)}</p>
                  {avatarError && <p className="text-xs text-red-600 mt-1">{avatarError}</p>}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="ชื่อ-นามสกุล" htmlFor="settings-name">
                <input id="settings-name" type="text" value={name} onChange={(e) => setName(e.target.value)} disabled={!isEditingProfile || Boolean(pendingRequest)} className={INPUT_CLASS} />
              </Field>
              <Field label="ชื่อเล่น" htmlFor="settings-nickname">
                <input id="settings-nickname" type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} disabled={!isEditingProfile || Boolean(pendingRequest)} className={INPUT_CLASS} />
              </Field>
              <Field label="เบอร์โทร" htmlFor="settings-phone" error={phoneError}>
                <input
                  id="settings-phone"
                  type="tel"
                  inputMode="numeric"
                  placeholder={isEditingProfile ? 'เช่น 0812345678' : '-'}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  disabled={!isEditingProfile}
                  className={INPUT_CLASS}
                />
              </Field>
              <Field label="อีเมล" htmlFor="settings-email" error={emailError}>
                <input id="settings-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!isEditingProfile} className={INPUT_CLASS} />
              </Field>
            </div>

            {isEditingProfile && needsApprovalForNames && !pendingRequest && (
              <p className="flex items-center gap-1.5 text-[11px] text-[#6F6F6F]">
                <ShieldCheck size={13} className="shrink-0" />
                การเปลี่ยนชื่อ-นามสกุลและชื่อเล่นต้องให้แอดมินอนุมัติก่อน
              </p>
            )}

            {pendingRequest ? (
              <div className="flex items-start gap-2.5 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-3">
                <Clock size={15} className="shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="font-semibold">มีคำขอเปลี่ยนชื่อรอแอดมินอนุมัติ</p>
                  {pendingChanges.name && <p className="mt-0.5">ชื่อ-นามสกุลใหม่: {pendingChanges.name}</p>}
                  {pendingChanges.nickname && <p className="mt-0.5">ชื่อเล่นใหม่: {pendingChanges.nickname}</p>}
                  <p className="mt-0.5">เหตุผล: {pendingRequest.reason}</p>
                </div>
              </div>
            ) : needsApproval && (
              <div>
                <label htmlFor="settings-reason" className="block text-[#272220] font-bold text-[11px] mb-1">
                  เหตุผลที่ขอเปลี่ยนชื่อ <span className="text-[#FF6537]">*</span>
                </label>
                <textarea
                  id="settings-reason"
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="ระบุเหตุผลเพื่อให้แอดมินพิจารณา..."
                  className="w-full p-2.5 text-sm border border-[#E5E5E5] rounded-xl placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#FF6537]"
                />
              </div>
            )}

            {profileError && (
              <p role="alert" className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{profileError}</p>
            )}

            {(isEditingProfile || profileSaved) && (
              <div className="flex items-center justify-end gap-3">
                {profileSaved && (
                  <span role="status" className="inline-flex items-center gap-1 text-xs font-semibold text-[#197A4B]">
                    <Check size={14} />
                    {profileSaved}
                  </span>
                )}
                {isEditingProfile && (
                  <>
                    <button
                      type="button"
                      onClick={handleCancelEditProfile}
                      disabled={isSavingProfile}
                      className="h-10 px-4 text-sm font-semibold text-[#6F6F6F] hover:bg-slate-50 rounded-xl border border-[#E5E5E5] cursor-pointer disabled:cursor-not-allowed"
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="submit"
                      disabled={!canSaveProfile}
                      className={`h-10 px-5 text-sm font-bold text-white rounded-xl transition-colors ${
                        canSaveProfile ? 'bg-[#FF6537] hover:bg-[#e6572c] cursor-pointer' : 'bg-[#F68C6C] cursor-not-allowed'
                      }`}
                    >
                      {isSavingProfile ? 'กำลังบันทึก...' : needsApproval ? 'บันทึกและส่งคำขอ' : 'บันทึกการเปลี่ยนแปลง'}
                    </button>
                  </>
                )}
              </div>
            )}
          </form>
        )}

        {section === 'password' && (
          <form onSubmit={handleChangePassword} className="px-6 py-5 space-y-4" noValidate>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="รหัสผ่านใหม่" htmlFor="settings-new-password" error={passwordTooShort ? `อย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร` : ''}>
                <PasswordInput id="settings-new-password" value={newPassword} onChange={setNewPassword} show={showNewPassword} onToggleShow={() => setShowNewPassword((v) => !v)} />
              </Field>
              <Field label="ยืนยันรหัสผ่านใหม่" htmlFor="settings-confirm-password" error={passwordMismatch ? 'รหัสผ่านไม่ตรงกัน' : ''}>
                <PasswordInput id="settings-confirm-password" value={confirmPassword} onChange={setConfirmPassword} show={showConfirmPassword} onToggleShow={() => setShowConfirmPassword((v) => !v)} />
              </Field>
            </div>

            {passwordError && (
              <p role="alert" className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{passwordError}</p>
            )}

            <div className="flex items-center justify-end gap-3">
              {passwordDone && (
                <span role="status" className="inline-flex items-center gap-1 text-xs font-semibold text-[#197A4B]">
                  <Check size={14} />
                  เปลี่ยนรหัสผ่านเรียบร้อยแล้ว
                </span>
              )}
              <button
                type="submit"
                disabled={!canSavePassword}
                className={`h-10 px-5 text-sm font-bold text-white rounded-xl transition-colors ${
                  canSavePassword ? 'bg-[#FF6537] hover:bg-[#e6572c] cursor-pointer' : 'bg-[#F68C6C] cursor-not-allowed'
                }`}
              >
                {isSavingPassword ? 'กำลังบันทึก...' : 'เปลี่ยนรหัสผ่าน'}
              </button>
            </div>
          </form>
        )}

        {section === 'notifications' && (
          <div className="pt-2 pb-2">
            <ul className="divide-y divide-[#EDEEEF]">
              {NOTIFICATION_CATEGORY_IDS.map((categoryId) => {
                const { label, description } = NOTIFICATION_CATEGORY_META[categoryId];
                return (
                  <li key={categoryId} className="flex items-center justify-between gap-4 px-6 py-4">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#272220]">{label}</p>
                      <p className="text-xs text-[#6F6F6F] mt-0.5">{description}</p>
                    </div>
                    <ToggleSwitch
                      checked={!mutedCategories.includes(categoryId)}
                      onChange={(enabled) => handleToggleCategory(categoryId, enabled)}
                      label={`รับการแจ้งเตือน${label}`}
                    />
                  </li>
                );
              })}
            </ul>
            {notificationsError && (
              <p role="alert" className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mx-6 mt-2 mb-3">{notificationsError}</p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
