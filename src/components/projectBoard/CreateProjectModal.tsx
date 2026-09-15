import { useState, useEffect, useRef, FormEvent, KeyboardEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { X, Check, Folder, Pencil, CalendarClock, Clock, ArrowRight } from 'lucide-react';
import { Employee } from '../../types';
import { ProjectPriority, ProjectStatus, ProjectType, CustomProjectStatus } from './types';
import { STATUS_LABEL, STATUS_PILL, PROJECT_TYPE_META, PROJECT_TYPE_OPTIONS } from './statusMeta';
import { getAvatarColor } from '../../lib/avatarColor';
import { ApiError, CreateProjectPayload } from '../../lib/api';
import Tooltip from '../Tooltip';

export function formatThaiDateShort(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  return `${String(d.getDate()).padStart(2, '0')} ${months[d.getMonth()]} ${d.getFullYear() + 543}`;
}

export const STATUS_OPTIONS: ProjectStatus[] = ['draft', 'pending_review', 'in_progress', 'on_hold', 'completed', 'cancelled', 'idea'];

// Numeric scale, 1 = most important — shared identically by a project's own priority and a
// task's priority (ProjectPriority in types.ts), so no translation is needed at any boundary
// (server, DB, or between this wizard and AddTaskModal/TaskDetailModal, which reuse this same
// array for task priority).
export type Priority = ProjectPriority;
export const PRIORITY_OPTIONS: { value: Priority; label: string; activeClass: string }[] = [
  { value: 1, label: '1', activeClass: 'bg-red-50 border-red-500 text-red-600' },
  { value: 2, label: '2', activeClass: 'bg-orange-50 border-orange-500 text-orange-600' },
  { value: 3, label: '3', activeClass: 'bg-[#FFF1EC] border-[#FF6537] text-[#FF6537]' },
  { value: 4, label: '4', activeClass: 'bg-blue-50 border-blue-400 text-blue-600' },
  { value: 5, label: '5', activeClass: 'bg-slate-100 border-slate-400 text-slate-600' },
];

type Duration = 'short' | 'long' | 'special';
const DURATION_OPTIONS: { value: Duration; label: string }[] = [
  { value: 'short', label: 'ระยะสั้น' },
  { value: 'long', label: 'ระยะยาว' },
  { value: 'special', label: 'พิเศษ' },
];

export function displayName(emp: Employee): string {
  return emp.nickname || emp.name;
}

// Shared avatar + name + role row so both the single- and multi-select dropdowns show the same
// profile-picture-and-position detail, not just a bare name.
function EmployeeOptionRow({ emp }: { emp: Employee }) {
  return (
    <span className="flex items-center gap-2.5 min-w-0">
      <img src={emp.avatar} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
      <span className="min-w-0">
        <span className="block truncate text-slate-800">{displayName(emp)}</span>
        <span className="block truncate text-[11px] text-slate-400">{emp.role} · {emp.department}</span>
      </span>
    </span>
  );
}

// Searchable single-select — type to filter, click to choose; once chosen, collapses to a
// name chip with a clear button so the field stays compact.
export function EmployeeSearchSelect({
  employees,
  valueId,
  onChange,
  placeholder
}: {
  employees: Employee[];
  valueId: string;
  onChange: (id: string) => void;
  placeholder: string;
}) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = employees.find((e) => e.id === valueId);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (selected) {
    return (
      <div className="flex items-center justify-between p-2 text-sm border border-[#E5E5E5] rounded-lg bg-white">
        <EmployeeOptionRow emp={selected} />
        <button type="button" onClick={() => onChange('')} className="text-slate-400 hover:text-slate-600 cursor-pointer shrink-0">
          <X size={14} />
        </button>
      </div>
    );
  }

  const filtered = employees.filter((e) => displayName(e).toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="relative" ref={ref}>
      <input
        type="text"
        placeholder={placeholder}
        value={query}
        onFocus={() => setIsOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
        }}
        className="w-full p-2.5 text-sm border border-[#E5E5E5] rounded-lg placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#FF6537]"
      />
      {isOpen && (
        <div className="absolute z-10 left-0 right-0 top-full mt-1 max-h-40 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg py-1">
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-xs text-slate-400">ไม่พบพนักงาน</p>
          ) : (
            filtered.map((emp) => (
              <button
                key={emp.id}
                type="button"
                onClick={() => {
                  onChange(emp.id);
                  setQuery('');
                  setIsOpen(false);
                }}
                className="w-full text-left px-3 py-2 hover:bg-[#FEFAF9] cursor-pointer"
              >
                <EmployeeOptionRow emp={emp} />
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// Same search-to-add pattern, but keeps a running list of picked employees as removable chips
// below the input instead of collapsing to a single value.
export function EmployeeMultiSelect({
  employees,
  valueIds,
  onChange,
  placeholder
}: {
  employees: Employee[];
  valueIds: string[];
  onChange: (ids: string[]) => void;
  placeholder: string;
}) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectedEmployees = employees.filter((e) => valueIds.includes(e.id));
  const filtered = employees.filter((e) => !valueIds.includes(e.id) && displayName(e).toLowerCase().includes(query.toLowerCase()));

  return (
    <div>
      <div className="relative" ref={ref}>
        <input
          type="text"
          placeholder={placeholder}
          value={query}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          className="w-full p-2.5 text-sm border border-[#E5E5E5] rounded-lg placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#FF6537]"
        />
        {isOpen && (
          <div className="absolute z-10 left-0 right-0 top-full mt-1 max-h-40 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-xs text-slate-400">
                {employees.length === valueIds.length ? 'เลือกครบทุกคนแล้ว' : 'ไม่พบพนักงาน'}
              </p>
            ) : (
              filtered.map((emp) => (
                <button
                  key={emp.id}
                  type="button"
                  onClick={() => {
                    onChange([...valueIds, emp.id]);
                    setQuery('');
                    setIsOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-[#FEFAF9] cursor-pointer"
                >
                  <EmployeeOptionRow emp={emp} />
                </button>
              ))
            )}
          </div>
        )}
      </div>
      {selectedEmployees.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selectedEmployees.map((emp) => (
            <Tooltip key={emp.id} content={emp.role}>
              <span
                className="inline-flex items-center gap-1.5 bg-[#FFF1EC] text-[#FF6537] text-xs font-medium pl-1 pr-2.5 py-1 rounded-full"
              >
                <img src={emp.avatar} alt="" className="w-5 h-5 rounded-full object-cover" />
                {displayName(emp)}
                <button
                  type="button"
                  onClick={() => onChange(valueIds.filter((id) => id !== emp.id))}
                  className="hover:text-[#e6572c] cursor-pointer"
                >
                  <X size={11} />
                </button>
              </span>
            </Tooltip>
          ))}
        </div>
      )}
    </div>
  );
}

const STEP_META: { step: 1 | 2 | 3; icon: typeof Pencil; label: string }[] = [
  { step: 1, icon: Pencil, label: 'กำหนดชื่อ' },
  { step: 2, icon: CalendarClock, label: 'ขอบเขตงาน' },
  { step: 3, icon: Check, label: 'สำเร็จ' },
];

function StepIndicator({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div className="flex items-start px-5 pt-5 pb-1">
      {STEP_META.map((s, idx) => {
        const isDone = s.step <= step;
        const isCurrent = s.step === step;
        const nextIsDone = idx < STEP_META.length - 1 && STEP_META[idx + 1].step <= step;
        const Icon = s.icon;
        return (
          <div key={s.step} className="flex items-start flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5 w-16 shrink-0">
              <div
                className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-all ${
                  isDone ? 'bg-[#FF6537] text-white' : 'bg-slate-200 text-slate-400'
                }`}
              >
                <Icon size={18} />
              </div>
              <span
                className={`text-[11px] text-center leading-tight ${
                  isCurrent ? 'font-bold text-[#FF6537]' : isDone ? 'font-medium text-[#272220]' : 'text-slate-400'
                }`}
              >
                {s.label}
              </span>
            </div>
            {idx < STEP_META.length - 1 && (
              <div className={`flex-1 h-0.5 mt-5.5 mx-1 transition-colors ${nextIsDone ? 'bg-[#FF6537]' : 'bg-slate-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function SummarySection({ title, dotColor, onEdit, children }: { title: string; dotColor: string; onEdit: () => void; children: ReactNode }) {
  return (
    <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
          <h4 className="text-sm font-bold text-[#272220]">{title}</h4>
        </div>
        <button type="button" onClick={onEdit} className="flex items-center gap-1 text-xs font-semibold text-[#FF6537] hover:underline cursor-pointer">
          <Pencil size={12} />
          แก้ไข
        </button>
      </div>
      <div className="px-4 py-3 space-y-3">{children}</div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-[#A0A0A0] shrink-0">{label}</span>
      <span className="text-[#272220] font-semibold text-right min-w-0">{value}</span>
    </div>
  );
}

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (payload: Omit<CreateProjectPayload, 'createdBy'>) => Promise<void>;
  onCreated: (title: string, folderCreated: boolean) => void;
  onCreateFolder: (name: string, parentId?: string | null, taskId?: string) => string;
  // Best-effort preview only — the real code (and its sequence number) is always generated
  // server-side at submit time; this just reflects it back live as the user picks a type/types
  // in an abbreviation, since the exact code can't be known until then.
  getNextCodePreview: (abbreviation: string, type: ProjectType | null) => string;
  employees: Employee[];
  existingTitles: string[];
  customStatuses: CustomProjectStatus[];
}

// Same silent auto-rename convention as CredentialVault's getUniqueLabel — a collision never
// blocks submission, it just gets a numeric suffix appended and the user is told so.
export function getUniqueTitle(desiredTitle: string, existingTitles: string[]): string {
  const trimmed = desiredTitle.trim();
  if (!trimmed) return trimmed;
  const lowerExisting = existingTitles.map((t) => t.trim().toLowerCase());
  if (!lowerExisting.includes(trimmed.toLowerCase())) return trimmed;
  let suffix = 2;
  while (lowerExisting.includes(`${trimmed}${suffix}`.toLowerCase())) suffix++;
  return `${trimmed}${suffix}`;
}

// "ตัวย่อชื่อโครงการ" suggestion — initials of the title's Latin words ("Grow store" → "GS"), or the
// capitals of a single CamelCase word ("WongWorkpath" → "WW"), else that word's first 2 letters.
// Thai has no word spacing or capital letters to key initials off, so a Thai-only title suggests
// nothing and the user types the abbreviation in themselves.
function deriveAbbreviation(title: string): string {
  const words = title.split(/\s+/).map((w) => w.replace(/[^A-Za-z]/g, '')).filter(Boolean);
  if (words.length === 0) return '';
  if (words.length === 1) {
    const capitals = words[0].replace(/[^A-Z]/g, '');
    return (capitals.length >= 2 ? capitals : words[0].slice(0, 2)).slice(0, 4).toUpperCase();
  }
  return words.slice(0, 4).map((w) => w[0]).join('').toUpperCase();
}

// Persists a real project row via onCreate (see AppDataContext's handleAddProject / the
// server/routes/projects.ts API) before firing onCreated for the success toast — if the API call
// fails, the form stays open and shows the error instead of closing, same pattern as
// EmployeeManagement's add-employee form. "ผู้รับผิดชอบงาน"/assigneeIds (shown as "ผู้รับผิดชอบร่วม"
// in the step 3 summary) is sent through as memberEmployeeIds and shows up in the project detail
// page's "ทีม" tab. The optional "create a folder" step writes to the shared document store via
// onCreateFolder, and only runs after the project itself is confirmed created.
export default function CreateProjectModal({ isOpen, onClose, onCreate, onCreated, onCreateFolder, getNextCodePreview, employees, existingTitles, customStatuses }: CreateProjectModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [title, setTitle] = useState('');
  const [renameNotice, setRenameNotice] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState<Duration | null>(null);
  const [type, setType] = useState<ProjectType | null>(null);
  const [abbreviation, setAbbreviation] = useState('');
  // Once the user types their own abbreviation, retyping the title stops overwriting it.
  const [abbreviationTouched, setAbbreviationTouched] = useState(false);
  const [ownerId, setOwnerId] = useState('');
  const [priority, setPriority] = useState<Priority | null>(null);
  const [status, setStatus] = useState<string>('draft');
  const [budget, setBudget] = useState('');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [memberDuties, setMemberDuties] = useState<Record<string, string>>({});
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [createFolder, setCreateFolder] = useState(true);
  const [folderName, setFolderName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const submitButtonRef = useRef<HTMLButtonElement>(null);

  // Step 3 is a read-only summary with no input fields — without this, reaching it (by button
  // click or by Enter) leaves nothing focused at all, so a further Enter press has no element to
  // bubble a keydown from and silently does nothing. Focusing the submit button gives Enter
  // somewhere to land, finishing the "Enter advances all the way to the end" behavior for real.
  useEffect(() => {
    if (step === 3) submitButtonRef.current?.focus();
  }, [step]);

  // "สร้างโฟลเดอร์เอกสาร" defaults to checked (see createFolder's initial state) — this seeds the
  // folder name from the title the first time step 2 is actually reached, the same "only if not
  // already set" rule the checkbox's own onChange used before it defaulted to checked at all.
  useEffect(() => {
    if (step === 2 && createFolder && !folderName.trim()) setFolderName(title.trim());
  }, [step]);

  const resetAndClose = () => {
    setStep(1);
    setTitle('');
    setRenameNotice('');
    setDescription('');
    setDuration(null);
    setType(null);
    setAbbreviation('');
    setAbbreviationTouched(false);
    setOwnerId('');
    setPriority(null);
    setStatus('draft');
    setBudget('');
    setAssigneeIds([]);
    setMemberDuties({});
    setStartDate('');
    setEndDate('');
    setCreateFolder(true);
    setFolderName('');
    setFormError('');
    onClose();
  };

  const step1Valid = title.trim() !== '';
  // Only meaningful once both dates are set — an open-ended start or end date has nothing to
  // compare against yet.
  const dateOrderValid = !(startDate && endDate && endDate < startDate);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!step1Valid || !dateOrderValid || isSubmitting) return;
    setFormError('');
    setIsSubmitting(true);
    // Safety net alongside the title field's own onBlur — Enter-driven step advances don't
    // reliably fire a native blur first, so a duplicate could otherwise slip through un-renamed.
    const finalTitle = getUniqueTitle(title, existingTitles);
    try {
      // Created first (not after) so its id can be saved as the project's own docFolderId in the
      // same request — a task's own "create folder" checkbox later nests inside this folder
      // instead of always dropping it at the Drive root.
      const willCreateFolder = createFolder && folderName.trim() !== '';
      const newFolderId = willCreateFolder ? onCreateFolder(folderName.trim()) : undefined;
      await onCreate({
        title: finalTitle,
        description: description.trim() || undefined,
        type: type ?? undefined,
        abbreviation: abbreviation.trim() || undefined,
        priority: priority ?? undefined,
        ownerEmployeeId: ownerId || undefined,
        memberEmployeeIds: assigneeIds,
        memberDuties: Object.fromEntries(
          Object.entries(memberDuties).filter(([id, duty]) => assigneeIds.includes(id) && duty.trim() !== '')
        ),
        docFolderId: newFolderId,
        status,
        budget: budget.trim() !== '' && !isNaN(Number(budget)) ? Number(budget) : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      onCreated(finalTitle, willCreateFolder);
      resetAndClose();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'สร้างโครงการไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSubmitting(false);
    }
  };

  const ownerEmp = employees.find((e) => e.id === ownerId);
  const assigneeEmps = employees.filter((e) => assigneeIds.includes(e.id));

  // Enter anywhere in the wizard advances to the next step, all the way through to actually
  // submitting on the final step — without this, hitting Enter in the title field on step 1 (the
  // form's only single-line text input at that point) triggers the browser's native implicit form
  // submission, which would call handleSubmit while still on step 1. Shift+Enter in the
  // "รายละเอียด" textarea still inserts a newline as usual. Step 3 has no focusable text fields, so
  // requestSubmit() is what actually lets Enter finish the wizard there (native implicit
  // submission only fires when a text field is focused, which step 3 never has).
  const handleWizardKeyDown = (e: KeyboardEvent<HTMLFormElement>) => {
    if (e.key !== 'Enter') return;
    if (e.shiftKey && (e.target as HTMLElement).tagName === 'TEXTAREA') return;
    e.preventDefault();
    if (step === 1 && step1Valid) setStep(2);
    else if (step === 2 && dateOrderValid) setStep(3);
    else if (step === 3) e.currentTarget.requestSubmit();
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div key="create-project-modal" className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Clicking the backdrop no longer closes the wizard — accidental clicks outside used to
              discard whatever had been filled in already, so closing is now only possible via the
              explicit X button below. */}
          <motion.div
            className="absolute inset-0 bg-black/15 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24, mass: 0.9 }}
            className="relative bg-white rounded-2xl shadow-[0px_12px_36px_-8px_rgba(0,0,0,0.12)] w-full max-w-md mx-4 max-h-[85vh] overflow-hidden flex flex-col"
          >
            <div className="flex justify-between items-center px-5 pt-5 pb-2 shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-800">สร้างโครงการใหม่</h3>
                  <span className="text-[10px] font-bold text-[#FF6537] bg-[#FFF1EC] px-2 py-0.5 rounded-full">{getNextCodePreview(abbreviation.trim().toUpperCase(), type)}</span>
                </div>
                <p className="text-[11px] text-[#6F6F6F] mt-0.5">
                  ตรวจสอบความถูกต้องของข้อมูลก่อนยืนยันการบันทึกเข้าสู่ระบบ
                </p>
              </div>
              <button onClick={resetAndClose} className="text-slate-400 hover:text-slate-600 cursor-pointer" type="button">
                <X size={18} />
              </button>
            </div>

            <StepIndicator step={step} />

            <form onSubmit={handleSubmit} onKeyDown={handleWizardKeyDown} className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 min-h-0 overflow-y-auto px-5 pt-4 pb-1 space-y-3">
                {step === 1 && (
                  <>
                    <div>
                      <label className="block text-[#272220] font-bold text-[11px] mb-1">
                        ชื่อโครงการ <span className="text-[#FF6537]">*</span>
                      </label>
                      <input
                        type="text"
                        autoFocus
                        placeholder="เช่น Grow store"
                        value={title}
                        onChange={(e) => {
                          setTitle(e.target.value);
                          if (!abbreviationTouched) setAbbreviation(deriveAbbreviation(e.target.value));
                        }}
                        onBlur={() => {
                          const unique = getUniqueTitle(title, existingTitles);
                          if (unique && unique !== title.trim()) {
                            setTitle(unique);
                            setRenameNotice(`ชื่อนี้ถูกใช้แล้ว เปลี่ยนเป็น "${unique}" ให้อัตโนมัติ`);
                            setTimeout(() => setRenameNotice(''), 4000);
                          }
                        }}
                        className="w-full p-2.5 text-sm border border-[#E5E5E5] rounded-lg placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#FF6537]"
                      />
                      {renameNotice && (
                        <p className="text-xs font-semibold text-[#FF6537] mt-1.5">ℹ️ {renameNotice}</p>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[#272220] font-bold text-[11px] mb-1">ประเภทโครงการ</label>
                        <select
                          value={type ?? ''}
                          onChange={(e) => setType((e.target.value || null) as ProjectType | null)}
                          className="w-full p-2.5 text-sm border border-[#E5E5E5] rounded-lg bg-white focus:outline-none focus:border-[#FF6537]"
                        >
                          <option value="">ไม่ระบุ</option>
                          {PROJECT_TYPE_OPTIONS.map((t) => (
                            <option key={t} value={t}>{PROJECT_TYPE_META[t].label} ({t})</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[#272220] font-bold text-[11px] mb-1">ตัวย่อโครงการ</label>
                        <input
                          type="text"
                          readOnly
                          tabIndex={-1}
                          value={type ?? ''}
                          placeholder="เลือกประเภทก่อน"
                          className="w-full p-2.5 text-sm border border-[#E5E5E5] rounded-lg bg-slate-50 text-[#6F6F6F] placeholder:text-[#B0B0B0] cursor-default focus:outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-baseline justify-between mb-1">
                        <label className="block text-[#272220] font-bold text-[11px]">ตัวย่อชื่อโครงการ</label>
                        <span className="text-[10px] text-[#6F6F6F]">ตั้งจากชื่อให้อัตโนมัติ แก้ไขเองได้</span>
                      </div>
                      <input
                        type="text"
                        placeholder="เช่น GS"
                        maxLength={10}
                        value={abbreviation}
                        onChange={(e) => {
                          const next = e.target.value.toUpperCase();
                          setAbbreviation(next);
                          // Clearing it hands control back to the title-derived suggestion.
                          setAbbreviationTouched(next.trim() !== '');
                        }}
                        className="w-full p-2.5 text-sm border border-[#E5E5E5] rounded-lg placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#FF6537]"
                      />
                    </div>
                    <div>
                      <label className="block text-[#272220] font-bold text-[11px] mb-1">ระยะโครงการ</label>
                      <div className="flex gap-2">
                        {DURATION_OPTIONS.map((d) => (
                          <button
                            key={d.value}
                            type="button"
                            onClick={() => setDuration((current) => (current === d.value ? null : d.value))}
                            className={`flex-1 h-9 rounded-lg text-xs font-semibold border cursor-pointer transition-colors ${
                              duration === d.value
                                ? 'bg-[#FFF1EC] border-[#FF6537] text-[#FF6537]'
                                : 'border-[#E5E5E5] text-[#6F6F6F] hover:bg-slate-50'
                            }`}
                          >
                            {d.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-[#272220] font-bold text-[11px] mb-1">รายละเอียด</label>
                      <textarea
                        rows={3}
                        placeholder="อธิบายเป้าหมายหรือขอบเขตของโครงการ..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full p-2.5 text-sm border border-[#E5E5E5] rounded-lg placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#FF6537]"
                      />
                    </div>
                  </>
                )}

                {step === 2 && (
                  <>
                    <div>
                      <label className="block text-[#272220] font-bold text-[11px] mb-1">ผู้รับผิดชอบหลัก</label>
                      <EmployeeSearchSelect
                        employees={employees}
                        valueId={ownerId}
                        onChange={setOwnerId}
                        placeholder="ค้นหาหรือเลือกพนักงาน..."
                      />
                    </div>

                    <div>
                      <div className="flex items-baseline justify-between mb-1">
                        <label className="block text-[#272220] font-bold text-[11px]">ระดับความสำคัญ</label>
                        <span className="text-[10px] text-[#A0A0A0]">1 = สำคัญที่สุด, 5 = สำคัญน้อยที่สุด</span>
                      </div>
                      <div className="flex gap-2">
                        {PRIORITY_OPTIONS.map((p) => (
                          <button
                            key={p.value}
                            type="button"
                            onClick={() => setPriority((current) => (current === p.value ? null : p.value))}
                            className={`flex-1 h-9 rounded-lg text-xs font-semibold border cursor-pointer transition-colors ${
                              priority === p.value ? p.activeClass : 'border-[#E5E5E5] text-[#6F6F6F] hover:bg-slate-50'
                            }`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[#272220] font-bold text-[11px] mb-1">สถานะ</label>
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        className="w-full p-2.5 text-sm border border-[#E5E5E5] rounded-lg bg-white focus:outline-none focus:border-[#FF6537]"
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                        ))}
                        {customStatuses.map((s) => (
                          <option key={s.id} value={s.id}>{s.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[#272220] font-bold text-[11px] mb-1">งบประมาณ (บาท)</label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-[#B0B0B0]">฿</span>
                        <input
                          type="number"
                          min="0"
                          step="1000"
                          placeholder="เช่น 500000"
                          value={budget}
                          onChange={(e) => setBudget(e.target.value)}
                          className="w-full p-2.5 pl-6 text-sm border border-[#E5E5E5] rounded-lg placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#FF6537]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[#272220] font-bold text-[11px] mb-1">ผู้รับผิดชอบงาน</label>
                      <EmployeeMultiSelect
                        employees={employees}
                        valueIds={assigneeIds}
                        onChange={setAssigneeIds}
                        placeholder="ค้นหาแล้วเลือกเพิ่มได้หลายคน..."
                      />
                      {assigneeEmps.length > 0 && (
                        <div className="mt-2 space-y-1.5">
                          {assigneeEmps.map((emp) => (
                            <div key={emp.id} className="flex items-center gap-2">
                              <Tooltip content={displayName(emp)}>
                                <span className="text-[11px] text-[#6F6F6F] w-20 truncate shrink-0">
                                  {displayName(emp)}
                                </span>
                              </Tooltip>
                              <input
                                type="text"
                                placeholder="หน้าที่ในโครงการนี้..."
                                value={memberDuties[emp.id] ?? ''}
                                onChange={(e) => setMemberDuties((prev) => ({ ...prev, [emp.id]: e.target.value }))}
                                className="flex-1 p-1.5 text-xs border border-[#E5E5E5] rounded-lg placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#FF6537]"
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[#272220] font-bold text-[11px] mb-1">วันที่เริ่ม</label>
                        <input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="w-full p-2.5 text-sm border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#FF6537]"
                        />
                      </div>
                      <div>
                        <label className="block text-[#272220] font-bold text-[11px] mb-1">วันที่สิ้นสุด</label>
                        <input
                          type="date"
                          value={endDate}
                          min={startDate || undefined}
                          onChange={(e) => setEndDate(e.target.value)}
                          className={`w-full p-2.5 text-sm border rounded-lg focus:outline-none focus:border-[#FF6537] ${
                            dateOrderValid ? 'border-[#E5E5E5]' : 'border-red-400'
                          }`}
                        />
                      </div>
                    </div>
                    {!dateOrderValid && (
                      <p className="text-xs text-red-600 -mt-1.5">วันที่สิ้นสุดต้องไม่อยู่ก่อนวันที่เริ่ม</p>
                    )}

                    <div className="border-t border-slate-100 pt-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={createFolder}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setCreateFolder(checked);
                            if (checked && !folderName.trim()) setFolderName(title.trim());
                          }}
                          className="rounded border-[#E5E5E5] text-[#FF6537] focus:ring-[#FF6537] cursor-pointer"
                        />
                        <Folder size={14} className="text-[#6F6F6F]" />
                        <span className="text-[#272220] font-bold text-[11px]">สร้างโฟลเดอร์เอกสารใน "เอกสาร Drive"</span>
                      </label>
                      {createFolder && (
                        <input
                          type="text"
                          placeholder="ชื่อโฟลเดอร์"
                          value={folderName}
                          onChange={(e) => setFolderName(e.target.value)}
                          className="w-full mt-2 p-2.5 text-sm border border-[#E5E5E5] rounded-lg placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#FF6537]"
                        />
                      )}
                    </div>
                  </>
                )}

                {step === 3 && (
                  <>
                    <SummarySection title="ข้อมูลโครงการ" dotColor="#FF6537" onEdit={() => setStep(1)}>
                      <SummaryRow label="ชื่อโครงการ" value={title} />
                      <SummaryRow
                        label="ประเภทโครงการ"
                        value={type ? `${PROJECT_TYPE_META[type].label} (${type})` : 'ไม่ระบุ'}
                      />
                      <SummaryRow label="ตัวย่อชื่อโครงการ" value={abbreviation || 'ไม่ระบุ'} />
                      <SummaryRow
                        label="ระยะโครงการ"
                        value={
                          duration ? (
                            <span className="inline-flex items-center gap-1.5 border border-slate-200 rounded-full px-2.5 py-1 text-[11px] font-medium text-[#272220]">
                              <Clock size={11} />
                              {DURATION_OPTIONS.find((d) => d.value === duration)!.label}
                            </span>
                          ) : 'ไม่ระบุ'
                        }
                      />
                      <SummaryRow
                        label="รายละเอียด"
                        value={
                          description ? (
                            <Tooltip content={description}>
                              <span className="line-clamp-2 break-all">{description}</span>
                            </Tooltip>
                          ) : 'ไม่ระบุ'
                        }
                      />
                    </SummarySection>

                    <SummarySection title="รายละเอียดเพิ่มเติม" dotColor="#94A3B8" onEdit={() => setStep(2)}>
                      <SummaryRow
                        label="ผู้รับผิดชอบหลัก"
                        value={
                          ownerEmp ? (
                            <span className="flex items-center gap-1.5 justify-end">
                              {ownerEmp.avatar ? (
                                <img src={ownerEmp.avatar} alt="" className="w-5 h-5 rounded-full object-cover shrink-0" />
                              ) : (
                                <span
                                  className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                                  style={{ backgroundColor: getAvatarColor(displayName(ownerEmp)) }}
                                >
                                  {displayName(ownerEmp).trim().charAt(0).toUpperCase()}
                                </span>
                              )}
                              <span className="truncate">{displayName(ownerEmp)} ({ownerEmp.role})</span>
                            </span>
                          ) : 'ไม่ระบุ'
                        }
                      />
                      <SummaryRow
                        label="ระดับความสำคัญ"
                        value={
                          priority ? (
                            <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-medium border ${PRIORITY_OPTIONS.find((p) => p.value === priority)!.activeClass}`}>
                              {PRIORITY_OPTIONS.find((p) => p.value === priority)!.label}
                            </span>
                          ) : 'ไม่ระบุ'
                        }
                      />
                      <SummaryRow
                        label="สถานะ"
                        value={
                          <span
                            className="inline-block px-2.5 py-1 rounded-full text-[11px] font-medium"
                            style={{ backgroundColor: STATUS_PILL[status].bg, color: STATUS_PILL[status].text }}
                          >
                            {STATUS_LABEL[status]}
                          </span>
                        }
                      />
                      <SummaryRow
                        label="งบประมาณ"
                        value={budget.trim() !== '' && !isNaN(Number(budget)) ? `฿${Number(budget).toLocaleString('th-TH')}` : 'ไม่ระบุ'}
                      />
                      <SummaryRow
                        label="ผู้รับผิดชอบร่วม"
                        value={
                          assigneeEmps.length > 0 ? (
                            <span className="flex items-center justify-end">
                              {assigneeEmps.slice(0, 3).map((emp, idx) => (
                                emp.avatar ? (
                                  <Tooltip key={emp.id} content={displayName(emp)}>
                                    <img
                                      src={emp.avatar}
                                      alt=""
                                      className={`w-6 h-6 rounded-full object-cover ring-2 ring-white ${idx > 0 ? '-ml-2' : ''}`}
                                    />
                                  </Tooltip>
                                ) : (
                                  <Tooltip key={emp.id} content={displayName(emp)}>
                                    <span
                                      className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold ring-2 ring-white ${idx > 0 ? '-ml-2' : ''}`}
                                      style={{ backgroundColor: getAvatarColor(displayName(emp)) }}
                                    >
                                      {displayName(emp).trim().charAt(0).toUpperCase()}
                                    </span>
                                  </Tooltip>
                                )
                              ))}
                              {assigneeEmps.length > 3 && (
                                <span className="ml-1.5 text-[11px] font-medium text-[#6F6F6F]">+{assigneeEmps.length - 3} สมาชิก</span>
                              )}
                            </span>
                          ) : 'ไม่ระบุ'
                        }
                      />
                      <SummaryRow
                        label="วันที่เริ่ม - สิ้นสุด"
                        value={
                          startDate || endDate
                            ? `${startDate ? formatThaiDateShort(startDate) : 'ไม่ระบุ'} — ${endDate ? formatThaiDateShort(endDate) : 'ไม่ระบุ'}`
                            : 'ไม่ระบุ'
                        }
                      />
                      <SummaryRow
                        label="โฟลเดอร์เอกสาร"
                        value={
                          createFolder && folderName.trim() ? (
                            <span className="inline-flex items-center gap-1.5 border border-slate-200 rounded-lg px-2.5 py-1 text-[11px] font-medium text-[#272220]">
                              <Folder size={11} className="text-[#FF6537]" />
                              {folderName.trim()}
                            </span>
                          ) : 'ไม่สร้าง'
                        }
                      />
                    </SummarySection>

                    {formError && (
                      <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{formError}</p>
                    )}
                  </>
                )}
              </div>

              <div className="shrink-0 px-5 pt-4 pb-5 flex items-center gap-3">
                {step > 1 && (
                  <button
                    type="button"
                    onClick={() => setStep((s) => (s - 1) as 1 | 2)}
                    className="px-4 h-10 text-sm font-semibold text-[#6F6F6F] hover:bg-slate-50 rounded-lg border border-[#E5E5E5] cursor-pointer"
                  >
                    ย้อนกลับ
                  </button>
                )}

                {step === 1 && (
                  <button
                    type="button"
                    disabled={!step1Valid}
                    onClick={() => setStep(2)}
                    className={`flex-1 h-10 text-white font-bold text-sm rounded-lg transition-colors ${
                      step1Valid ? 'bg-[#FF6537] hover:bg-[#e6572c] cursor-pointer' : 'bg-[#F68C6C] cursor-not-allowed'
                    }`}
                  >
                    ถัดไป
                  </button>
                )}

                {step === 2 && (
                  <button
                    type="button"
                    disabled={!dateOrderValid}
                    onClick={() => setStep(3)}
                    className={`flex-1 h-10 text-white font-bold text-sm rounded-lg transition-colors ${
                      dateOrderValid ? 'bg-[#FF6537] hover:bg-[#e6572c] cursor-pointer' : 'bg-[#F68C6C] cursor-not-allowed'
                    }`}
                  >
                    ถัดไป
                  </button>
                )}

                {step === 3 && (
                  <button
                    ref={submitButtonRef}
                    type="submit"
                    disabled={isSubmitting}
                    className={`flex-1 h-10 flex items-center justify-center gap-1.5 text-white font-bold text-sm rounded-lg transition-colors ${
                      isSubmitting ? 'bg-[#F68C6C] cursor-not-allowed' : 'bg-[#FF6537] hover:bg-[#e6572c] cursor-pointer'
                    }`}
                  >
                    {isSubmitting ? 'กำลังสร้าง...' : 'สร้างโครงการ'}
                    {!isSubmitting && <ArrowRight size={16} />}
                  </button>
                )}
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
