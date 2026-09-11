import { useState, useEffect, useRef, FormEvent, KeyboardEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { X, Check, Folder, Pencil, CalendarClock, Clock, ArrowRight } from 'lucide-react';
import { Employee } from '../../types';
import { ProjectPriority, ProjectStatus } from './types';
import { STATUS_LABEL, STATUS_PILL } from './statusMeta';
import { getAvatarColor } from '../../lib/avatarColor';
import { ApiError, CreateProjectPayload } from '../../lib/api';

export function formatThaiDateShort(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  return `${String(d.getDate()).padStart(2, '0')} ${months[d.getMonth()]} ${d.getFullYear() + 543}`;
}

export const STATUS_OPTIONS: ProjectStatus[] = ['draft', 'in_progress', 'on_hold', 'completed', 'cancelled'];

export type Priority = 'high' | 'medium' | 'low';
export const PRIORITY_OPTIONS: { value: Priority; label: string; activeClass: string }[] = [
  { value: 'high', label: 'สูง', activeClass: 'bg-red-50 border-red-500 text-red-600' },
  { value: 'medium', label: 'กลาง', activeClass: 'bg-[#FFF1EC] border-[#FF6537] text-[#FF6537]' },
  { value: 'low', label: 'ต่ำ', activeClass: 'bg-slate-100 border-slate-400 text-slate-600' },
];

// The wizard's own Priority scale is lowercase ('high'/'medium'/'low'), but ProjectRow.priority
// (and the project API) use capitalized values shared with other parts of the app — map at the
// submit boundary rather than changing this scale's casing everywhere it's already used (task
// priority in AddTaskModal/TaskDetailModal shares this same lowercase scale).
export const PRIORITY_TO_ROW: Record<Priority, ProjectPriority> = { high: 'High', medium: 'Medium', low: 'Low' };
export const ROW_TO_PRIORITY: Record<ProjectPriority, Priority> = { High: 'high', Medium: 'medium', Low: 'low' };

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
            <span
              key={emp.id}
              title={emp.role}
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
  onCreateFolder: (name: string) => void;
  nextCode: string;
  employees: Employee[];
}

// Persists a real project row via onCreate (see AppDataContext's handleAddProject / the
// server/routes/projects.ts API) before firing onCreated for the success toast — if the API call
// fails, the form stays open and shows the error instead of closing, same pattern as
// EmployeeManagement's add-employee form. "ผู้รับผิดชอบงาน" is single employees only for now (no
// reusable team builder yet — deferred per user decision) and isn't persisted as part of the
// project row yet. The optional "create a folder" step writes to the shared document store via
// onCreateFolder, and only runs after the project itself is confirmed created.
export default function CreateProjectModal({ isOpen, onClose, onCreate, onCreated, onCreateFolder, nextCode, employees }: CreateProjectModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState<Duration | null>(null);
  const [ownerId, setOwnerId] = useState('');
  const [priority, setPriority] = useState<Priority | null>(null);
  const [status, setStatus] = useState<ProjectStatus>('draft');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [createFolder, setCreateFolder] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const resetAndClose = () => {
    setStep(1);
    setTitle('');
    setDescription('');
    setDuration(null);
    setOwnerId('');
    setPriority(null);
    setStatus('draft');
    setAssigneeIds([]);
    setStartDate('');
    setEndDate('');
    setCreateFolder(false);
    setFolderName('');
    setFormError('');
    onClose();
  };

  const step1Valid = title.trim() !== '';

  const skipStep2 = () => {
    setOwnerId('');
    setPriority(null);
    setAssigneeIds([]);
    setStartDate('');
    setEndDate('');
    setCreateFolder(false);
    setFolderName('');
    setStep(3);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!step1Valid || isSubmitting) return;
    setFormError('');
    setIsSubmitting(true);
    try {
      await onCreate({
        title: title.trim(),
        description: description.trim() || undefined,
        priority: priority ? PRIORITY_TO_ROW[priority] : undefined,
        ownerEmployeeId: ownerId || undefined,
        status,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      const willCreateFolder = createFolder && folderName.trim() !== '';
      if (willCreateFolder) onCreateFolder(folderName.trim());
      onCreated(title.trim(), willCreateFolder);
      resetAndClose();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'สร้างโครงการไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSubmitting(false);
    }
  };

  const ownerEmp = employees.find((e) => e.id === ownerId);
  const assigneeEmps = employees.filter((e) => assigneeIds.includes(e.id));

  // Enter anywhere in the wizard advances to the next step instead of submitting the form early —
  // without this, hitting Enter in the title field on step 1 (the form's only single-line text
  // input at that point) triggers the browser's native implicit form submission, which would call
  // handleSubmit while still on step 1. Shift+Enter in the "รายละเอียด" textarea still inserts a
  // newline as usual. Step 3 has no focusable text fields, so Enter there falls through to the
  // real submit button unaffected.
  const handleWizardKeyDown = (e: KeyboardEvent<HTMLFormElement>) => {
    if (e.key !== 'Enter') return;
    if (e.shiftKey && (e.target as HTMLElement).tagName === 'TEXTAREA') return;
    if (step === 3) return;
    e.preventDefault();
    if (step === 1 && step1Valid) setStep(2);
    else if (step === 2) setStep(3);
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
                  <span className="text-[10px] font-bold text-[#FF6537] bg-[#FFF1EC] px-2 py-0.5 rounded-full">{nextCode}</span>
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
                        onChange={(e) => setTitle(e.target.value)}
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
                      <label className="block text-[#272220] font-bold text-[11px] mb-1">ระดับความสำคัญ</label>
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
                        onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                        className="w-full p-2.5 text-sm border border-[#E5E5E5] rounded-lg bg-white focus:outline-none focus:border-[#FF6537]"
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[#272220] font-bold text-[11px] mb-1">ผู้รับผิดชอบงาน</label>
                      <EmployeeMultiSelect
                        employees={employees}
                        valueIds={assigneeIds}
                        onChange={setAssigneeIds}
                        placeholder="ค้นหาแล้วเลือกเพิ่มได้หลายคน..."
                      />
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
                          onChange={(e) => setEndDate(e.target.value)}
                          className="w-full p-2.5 text-sm border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#FF6537]"
                        />
                      </div>
                    </div>

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
                            <span className="line-clamp-2 break-all" title={description}>{description}</span>
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
                        label="ผู้รับผิดชอบร่วม"
                        value={
                          assigneeEmps.length > 0 ? (
                            <span className="flex items-center justify-end">
                              {assigneeEmps.slice(0, 3).map((emp, idx) => (
                                emp.avatar ? (
                                  <img
                                    key={emp.id}
                                    src={emp.avatar}
                                    alt=""
                                    title={displayName(emp)}
                                    className={`w-6 h-6 rounded-full object-cover ring-2 ring-white ${idx > 0 ? '-ml-2' : ''}`}
                                  />
                                ) : (
                                  <span
                                    key={emp.id}
                                    title={displayName(emp)}
                                    className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold ring-2 ring-white ${idx > 0 ? '-ml-2' : ''}`}
                                    style={{ backgroundColor: getAvatarColor(displayName(emp)) }}
                                  >
                                    {displayName(emp).trim().charAt(0).toUpperCase()}
                                  </span>
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
                  <>
                    <button
                      type="button"
                      onClick={skipStep2}
                      className="px-4 h-10 text-sm font-semibold text-[#6F6F6F] hover:bg-slate-50 rounded-lg border border-[#E5E5E5] cursor-pointer"
                    >
                      ข้าม
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      className="flex-1 h-10 text-white font-bold text-sm rounded-lg bg-[#FF6537] hover:bg-[#e6572c] cursor-pointer transition-colors"
                    >
                      ถัดไป
                    </button>
                  </>
                )}

                {step === 3 && (
                  <button
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
