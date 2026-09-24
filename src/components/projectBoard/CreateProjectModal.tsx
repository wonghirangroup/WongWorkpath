import { useState, useEffect, useLayoutEffect, useRef, FormEvent, KeyboardEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { X, Check, Folder, Pencil, CalendarClock, ArrowRight, Plus } from 'lucide-react';
import { Employee } from '../../types';
import { ProjectPriority, ProjectStatus, ProjectRow, CustomProjectStatus, CustomProjectType } from './types';
import { STATUS_LABEL, STATUS_PILL, PROJECT_TYPE_META, PROJECT_TYPE_OPTIONS } from './statusMeta';
import { getAvatarColor } from '../../lib/avatarColor';
import { ApiError, CreateProjectPayload } from '../../lib/api';
import { formatThaiDateShort } from '../../lib/datetime';
import { formatThousands } from '../../lib/numberFormat';
import { computePanelPlacement, PanelPlacement } from '../../lib/floatingPanel';
import Tooltip from '../Tooltip';
import EmployeeAvatar from '../EmployeeAvatar';
import ThaiDatePicker from '../ThaiDatePicker';
import Dropdown from '../Dropdown';
import { useEscapeToClose } from '../../lib/useEscapeToClose';
import { useAppData } from '../../context/AppDataContext';
import DeadlineReminderField from '../DeadlineReminderField';
import { DEFAULT_DEADLINE_REMINDER_DAYS } from '../../lib/deadlineReminders';

// Re-exported for backward compatibility — every other file that formats a Thai date already
// imports this from here; the implementation itself now lives in lib/datetime.ts so ThaiDatePicker
// (and other lib/ code) can use it without importing back from this component.
export { formatThaiDateShort };

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

export function displayName(emp: Employee): string {
  return emp.nickname || emp.name;
}

// Shared avatar + name + role row so both the single- and multi-select dropdowns show the same
// profile-picture-and-position detail, not just a bare name.
function EmployeeOptionRow({ emp }: { emp: Employee }) {
  return (
    <span className="flex items-center gap-2.5 min-w-0">
      {emp.avatar ? (
        <img src={emp.avatar} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
      ) : (
        <EmployeeAvatar name={displayName(emp)} sizePx={28} />
      )}
      <span className="min-w-0">
        <span className="block truncate text-slate-800">{displayName(emp)}</span>
        {/* ผู้บริหาร/หัวหน้าฝ่าย sit over a whole ฝ่าย and are exempt from needing a department (see
            employees.ts's isDepartmentExempt) — falls back to showing their division instead of a
            dangling "role · " with nothing after it. */}
        <span className="block truncate text-[11px] text-slate-400">
          {emp.role}{(emp.department || emp.division) ? ` · ${emp.department || emp.division}` : ''}
        </span>
      </span>
    </span>
  );
}

// The suggestion list's own max height before it scrolls (10rem — three avatar+role rows), same as
// the old absolute panel's `max-h-40`.
const MULTISELECT_PANEL_MAX_HEIGHT = 160;

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
  const [placement, setPlacement] = useState<PanelPlacement | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // The suggestion list renders through a portal with fixed positioning (same as Dropdown) instead
  // of as an absolute child of the field: inside a modal, an in-flow absolute panel was clipped by
  // the form body's own overflow and hidden behind the footer buttons whenever the field sat near
  // the bottom. Placement (flip above / shrink to fit) is shared with Dropdown via floatingPanel.ts.
  const reposition = () => {
    if (inputRef.current) setPlacement(computePanelPlacement(inputRef.current.getBoundingClientRect(), MULTISELECT_PANEL_MAX_HEIGHT));
  };
  useLayoutEffect(() => {
    if (isOpen) reposition();
  }, [isOpen]);

  useEffect(() => {
    // The panel now lives outside `ref` (it's portaled to <body>), so a mousedown inside it must
    // count as "inside" too — otherwise picking an option would close the list before the click lands.
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target) || panelRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Re-anchor (rather than close) when the page/modal scrolls or the window resizes while open —
  // focusing a field near an edge can itself trigger a scroll, which must not slam the list shut.
  useEffect(() => {
    if (!isOpen) return;
    const onMove = (e: Event) => {
      if (panelRef.current && e.target instanceof Node && panelRef.current.contains(e.target)) return;
      reposition();
    };
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [isOpen]);

  const selectedEmployees = employees.filter((e) => valueIds.includes(e.id));
  const filtered = employees.filter((e) => !valueIds.includes(e.id) && displayName(e).toLowerCase().includes(query.toLowerCase()));

  return (
    <div>
      <div className="relative" ref={ref}>
        <input
          ref={inputRef}
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
        {isOpen && placement && createPortal(
          <div
            ref={panelRef}
            style={{
              position: 'fixed',
              top: placement.top,
              bottom: placement.bottom,
              left: placement.left,
              width: placement.width,
              maxHeight: placement.maxHeight,
            }}
            className="z-60 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg py-1"
          >
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
          </div>,
          document.body
        )}
      </div>
      {selectedEmployees.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selectedEmployees.map((emp) => (
            <Tooltip key={emp.id} content={emp.role}>
              <span
                className="inline-flex items-center gap-1.5 bg-[#FFF1EC] text-[#FF6537] text-xs font-medium pl-1 pr-2.5 py-1 rounded-full"
              >
                {emp.avatar ? (
                  <img src={emp.avatar} alt="" className="w-5 h-5 rounded-full object-cover" />
                ) : (
                  <EmployeeAvatar name={displayName(emp)} sizePx={20} />
                )}
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
    <div className="flex items-start px-5 pt-4 pb-1 w-full max-w-2xl mx-auto">
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
    <div className="bg-white border border-slate-100 rounded-xl overflow-hidden h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
          <h4 className="text-sm font-bold text-[#272220]">{title}</h4>
        </div>
        <button type="button" onClick={onEdit} className="flex items-center gap-1 text-xs font-semibold text-[#FF6537] hover:underline cursor-pointer">
          <Pencil size={12} />
          แก้ไข
        </button>
      </div>
      {/* flex column (not space-y) so a child can claim the card's leftover height — see the
          รายละเอียด block on the summary step. */}
      <div className="px-4 py-3 flex flex-col gap-3 flex-1 min-h-0">{children}</div>
    </div>
  );
}

// A summary field whose value is free text that deserves the room — fills whatever height the card
// has left below the plain rows instead of being squeezed onto one right-aligned line. The text sits
// in an absolutely-positioned scroller, so a very long description scrolls inside its own box and
// never makes the card (and with it the whole modal) taller than the card beside it.
function SummaryTextBlock({ label, text }: { label: string; text: string }) {
  return (
    <div className="flex flex-col flex-1 min-h-28 lg:min-h-16 gap-1">
      <span className="text-xs text-[#767676]">{label}</span>
      <div className="relative flex-1 min-h-0">
        <p className="absolute inset-0 overflow-y-auto text-xs font-medium leading-normal text-[#272220] whitespace-pre-wrap wrap-break-word">
          {text.trim() ? text : <span className="font-semibold">ไม่ระบุ</span>}
        </p>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-[#767676] shrink-0">{label}</span>
      <span className="text-[#272220] font-semibold text-right min-w-0">{value}</span>
    </div>
  );
}

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Resolves with the created project — its id is needed to save this person's own "เตือนก่อนวันสิ้นสุด" choice.
  onCreate: (payload: Omit<CreateProjectPayload, 'createdBy'>) => Promise<{ id: string }>;
  onCreated: (title: string, folderCreated: boolean) => void;
  onCreateFolder: (name: string, parentId: string | null, taskId: string | undefined, projectId: string) => Promise<string>;
  // Best-effort preview only — the real code (and its sequence number) is always generated
  // server-side at submit time; this just reflects it back live as the user picks a type/types
  // in an abbreviation, since the exact code can't be known until then.
  getNextCodePreview: (abbreviation: string, type: string | null) => string;
  employees: Employee[];
  existingTitles: string[];
  customStatuses: CustomProjectStatus[];
  customTypes: CustomProjectType[];
  onAddCustomType: (label: string, abbreviation: string) => Promise<CustomProjectType>;
  // For the "โครงการหลัก" picker, offered only when type === 'SP' — filtered down to just the
  // top-level "โครงการ (P)" ones right where it's used below, not here, so the full list stays
  // available if this modal ever needs it for something else later.
  projects: ProjectRow[];
}

// Sentinel dropdown value for "อื่นๆ ระบุ..." — picking it reveals free-entry name/abbreviation
// inputs; the real custom type is only actually created (via onAddCustomType) at final submit, so
// backing out of the wizard without submitting never pollutes the shared custom-type list.
const CUSTOM_TYPE_VALUE = '__custom__';

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
export default function CreateProjectModal({ isOpen, onClose, onCreate, onCreated, onCreateFolder, getNextCodePreview, employees, existingTitles, customStatuses, customTypes, onAddCustomType, projects }: CreateProjectModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [title, setTitle] = useState('');
  const [renameNotice, setRenameNotice] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<string | null>(null);
  const [customTypeName, setCustomTypeName] = useState('');
  const [customTypeAbbrev, setCustomTypeAbbrev] = useState('');
  const [parentProjectId, setParentProjectId] = useState<string | null>(null);
  const [abbreviation, setAbbreviation] = useState('');
  // Once the user types their own abbreviation, retyping the title stops overwriting it.
  const [abbreviationTouched, setAbbreviationTouched] = useState(false);
  const [ownerIds, setOwnerIds] = useState<string[]>([]);
  const [priority, setPriority] = useState<Priority | null>(null);
  const [status, setStatus] = useState<string>('draft');
  const [budget, setBudget] = useState('');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [memberDuties, setMemberDuties] = useState<Record<string, string>>({});
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  // My own "เตือนก่อนวันสิ้นสุด" choice — held here (null = the default) until the project exists.
  const [pendingReminder, setPendingReminder] = useState<number[] | null>(null);
  const { handleSetDeadlineReminder, currentUser } = useAppData();
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
    setType(null);
    setCustomTypeName('');
    setCustomTypeAbbrev('');
    setParentProjectId(null);
    setAbbreviation('');
    setAbbreviationTouched(false);
    setOwnerIds([]);
    setPriority(null);
    setStatus('draft');
    setBudget('');
    setAssigneeIds([]);
    setMemberDuties({});
    setStartDate('');
    setEndDate('');
    setPendingReminder(null);
    setCreateFolder(true);
    setFolderName('');
    setFormError('');
    onClose();
  };

  useEscapeToClose(isOpen, resetAndClose);

  // ตัวย่อโครงการ is required (not just auto-derived) because deriveAbbreviation only works on
  // Latin letters — a Thai-only title (the overwhelming majority here) derives nothing, and
  // without this check that silently produced a generic "PRJ-NNN" code instead of the intended
  // "{ตัวย่อ}-{ปี}-{ประเภท}-{ลำดับ}" format (see generateProjectCode server-side).
  const isCustomTypeSelected = type === CUSTOM_TYPE_VALUE;
  const isSubProject = type === 'SP';
  const topLevelProjects = projects.filter((p) => p.type === 'P');
  const step1Valid = title.trim() !== '' && type !== null && abbreviation.trim() !== ''
    && (!isCustomTypeSelected || (customTypeName.trim() !== '' && customTypeAbbrev.trim() !== ''))
    && (!isSubProject || parentProjectId !== null);
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
      // A brand-new "อื่นๆ ระบุ..." type is only actually registered here, right before the
      // project itself is created — never earlier in the wizard — so backing out without
      // submitting never leaves an orphaned custom type in the shared list. Its real (server-
      // validated, uppercased) abbreviation becomes this project's own `type` value below.
      let finalType = type;
      if (isCustomTypeSelected) {
        const createdType = await onAddCustomType(customTypeName.trim(), customTypeAbbrev.trim());
        finalType = createdType.id;
      }
      // Created first (not after) so its id can be saved as the project's own docFolderId in the
      // same request — a task's own "create folder" checkbox later nests inside this folder
      // instead of always dropping it at the Drive root. The folder's own document row needs to be
      // tagged scope='โครงการ' + this project's id right away (so the project's own team can see
      // it under the new "โครงการ" visibility rule) — but the project doesn't exist yet at this
      // point, so its id is generated here, client-side, and reused for both this project's own
      // creation request below and the folder's tag, rather than the usual server-generated one.
      const willCreateFolder = createFolder && folderName.trim() !== '';
      const newProjectId = willCreateFolder ? `PROJ_${Date.now()}` : undefined;
      const newFolderId = willCreateFolder && newProjectId ? await onCreateFolder(folderName.trim(), null, undefined, newProjectId) : undefined;
      const createdProject = await onCreate({
        id: newProjectId,
        title: finalTitle,
        description: description.trim() || undefined,
        type: finalType ?? undefined,
        abbreviation: abbreviation.trim() || undefined,
        parentProjectId: isSubProject ? parentProjectId ?? undefined : undefined,
        priority: priority ?? undefined,
        ownerEmployeeIds: ownerIds,
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
      // Only a choice the person actually made is saved — untouched means "use the default".
      if (pendingReminder !== null) handleSetDeadlineReminder('project', createdProject.id, pendingReminder);
      onCreated(finalTitle, willCreateFolder);
      resetAndClose();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'สร้างโครงการไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSubmitting(false);
    }
  };

  const ownerEmps = employees.filter((e) => ownerIds.includes(e.id));
  const assigneeEmps = employees.filter((e) => assigneeIds.includes(e.id));

  // Someone can't be both ผู้รับผิดชอบหลัก and ผู้รับผิดชอบร่วม at once — matches
  // AddResponsibleModal/EditProjectModal's own handleOwnersChange. The pickers below also each
  // exclude the other list's current people so it can't happen from the UI in the first place;
  // this is just the reactive cleanup half of that same rule.
  const handleOwnersChange = (ids: string[]) => {
    setOwnerIds(ids);
    setAssigneeIds((prev) => prev.filter((id) => !ids.includes(id)));
  };

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
            role="dialog" aria-modal="true" aria-label="สร้างโครงการใหม่" className="relative bg-white rounded-2xl shadow-[0px_12px_36px_-8px_rgba(0,0,0,0.12)] w-full max-w-lg lg:max-w-5xl mx-4 max-h-[94vh] overflow-hidden flex flex-col"
          >
            <div className="flex justify-between items-center px-5 pt-5 pb-2 shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-800">สร้างโครงการใหม่</h3>
                  <span className="text-[11px] font-bold text-[#FF6537] bg-[#FFF1EC] px-2 py-0.5 rounded-full">
                    {getNextCodePreview(abbreviation.trim().toUpperCase(), isCustomTypeSelected ? (customTypeAbbrev.trim().toUpperCase() || null) : type)}
                  </span>
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
                  // Two columns from lg up (what it is / how it's coded), one column below — see the
                  // matching comment on AddTaskModal: this wizard is meant to fit without a scrollbar.
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-3 items-stretch">
                    <div className="space-y-3 min-w-0">
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
                        <label className="block text-[#272220] font-bold text-[11px] mb-1">
                          ประเภทโครงการ <span className="text-[#FF6537]">*</span>
                        </label>
                        <Dropdown<string>
                          value={type ?? ''}
                          onChange={(v) => setType(v || null)}
                          placeholder="เลือกประเภทโครงการ"
                          options={[
                            ...PROJECT_TYPE_OPTIONS.map((t) => ({ value: t as string, label: `${PROJECT_TYPE_META[t].label} (${t})` })),
                            ...customTypes.map((t) => ({ value: t.id, label: `${t.label} (${t.id})` })),
                            { value: CUSTOM_TYPE_VALUE, label: <span className="flex items-center gap-1.5"><Plus size={12} /> อื่นๆ ระบุ...</span> },
                          ]}
                        />
                      </div>
                      <div>
                        <label className="block text-[#272220] font-bold text-[11px] mb-1">
                          ตัวย่อประเภทโครงการ <span className="text-[#FF6537]">*</span>
                        </label>
                        {isCustomTypeSelected ? (
                          <input
                            type="text"
                            placeholder="เช่น MKT"
                            maxLength={10}
                            value={customTypeAbbrev}
                            onChange={(e) => setCustomTypeAbbrev(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                            className="w-full p-2.5 text-sm border border-[#E5E5E5] rounded-lg placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#FF6537]"
                          />
                        ) : (
                          <input
                            type="text"
                            readOnly
                            tabIndex={-1}
                            value={type ?? ''}
                            placeholder="เลือกประเภทก่อน"
                            className="w-full p-2.5 text-sm border border-[#E5E5E5] rounded-lg bg-slate-50 text-[#6F6F6F] placeholder:text-[#B0B0B0] cursor-default focus:outline-none"
                          />
                        )}
                      </div>
                    </div>
                    {isCustomTypeSelected && (
                      <div>
                        <label className="block text-[#272220] font-bold text-[11px] mb-1">
                          ชื่อประเภทโครงการ <span className="text-[#FF6537]">*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="เช่น การตลาดพิเศษ"
                          value={customTypeName}
                          onChange={(e) => setCustomTypeName(e.target.value)}
                          className="w-full p-2.5 text-sm border border-[#E5E5E5] rounded-lg placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#FF6537]"
                        />
                        <p className="text-[11px] text-[#767676] mt-1">
                          ประเภทและตัวย่อนี้จะถูกบันทึกไว้ให้เลือกใช้กับโครงการอื่นได้ในครั้งถัดไป
                        </p>
                      </div>
                    )}
                    {isSubProject && (
                      <div>
                        <label className="block text-[#272220] font-bold text-[11px] mb-1">
                          โครงการหลัก <span className="text-[#FF6537]">*</span>
                        </label>
                        {topLevelProjects.length === 0 ? (
                          <p className="text-xs text-[#767676] bg-slate-50 border border-[#E5E5E5] rounded-lg px-3 py-2.5">
                            ยังไม่มีโครงการประเภท "โครงการ (P)" ในระบบให้เลือกเป็นโครงการหลัก
                          </p>
                        ) : (
                          <Dropdown<string>
                            value={parentProjectId ?? ''}
                            onChange={(v) => setParentProjectId(v || null)}
                            placeholder="เลือกโครงการหลัก"
                            options={topLevelProjects.map((p) => ({ value: p.id, label: `${p.title} (${p.code})` }))}
                          />
                        )}
                        <p className="text-[11px] text-[#767676] mt-1">โครงการย่อยต้องผูกกับโครงการหลักที่เป็นประเภท "โครงการ (P)" เท่านั้น</p>
                      </div>
                    )}
                    <div>
                      <div className="flex items-baseline justify-between mb-1">
                        <label className="block text-[#272220] font-bold text-[11px]">
                          ตัวย่อชื่อโครงการ <span className="text-[#FF6537]">*</span>
                        </label>
                        <span className="text-[11px] text-[#6F6F6F]">ตั้งจากชื่อให้อัตโนมัติถ้าเป็นภาษาอังกฤษ ไม่งั้นพิมพ์เอง</span>
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
                      <p className="text-[11px] text-[#767676] mt-1">ใช้ประกอบรหัสโครงการ (เช่น GS-69-P-001) — จำเป็นต้องกรอก</p>
                    </div>
                    </div>
                    {/* Right column is just the description, stretched to the same height as the
                        three stacked fields beside it — so the two columns always end together
                        however many optional fields (custom type, parent project) the left shows. */}
                    <div className="flex flex-col min-w-0">
                      <label className="block text-[#272220] font-bold text-[11px] mb-1">รายละเอียด</label>
                      <textarea
                        rows={3}
                        placeholder="อธิบายเป้าหมายหรือขอบเขตของโครงการ..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full flex-1 min-h-24 resize-none p-2.5 text-sm border border-[#E5E5E5] rounded-lg placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#FF6537]"
                      />
                    </div>
                  </div>
                )}

                {step === 2 && (
                  // Two independent columns, with the fields ordered so each left/right pair is the same
                  // height when empty (people / priority + status + budget / dates + folder). A shared
                  // row grid lined them up too, but left a big hole under one side whenever the other
                  // grew (e.g. assignee duty rows) — independent columns just let the taller one grow down.
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-3 items-start">
                    <div className="space-y-3 min-w-0">
                      <div>
                        <div className="flex items-baseline justify-between mb-1">
                          <label className="block text-[#272220] font-bold text-[11px]">ผู้รับผิดชอบหลัก</label>
                          <span className="text-[11px] text-[#6F6F6F]">เลือกได้หลายคน สิทธิ์เท่ากันทุกคน</span>
                        </div>
                        <EmployeeMultiSelect
                          employees={employees.filter((emp) => !assigneeIds.includes(emp.id))}
                          valueIds={ownerIds}
                          onChange={handleOwnersChange}
                          placeholder="ค้นหาแล้วเลือกเพิ่มได้หลายคน..."
                        />
                      </div>

                      <div>
                        <div className="flex items-baseline justify-between mb-1">
                          <label className="block text-[#272220] font-bold text-[11px]">ระดับความสำคัญ</label>
                          <span className="text-[11px] text-[#767676]">1 = สำคัญที่สุด, 5 = สำคัญน้อยที่สุด</span>
                        </div>
                        <div className="flex gap-2">
                          {PRIORITY_OPTIONS.map((p) => (
                            <button
                              key={p.value}
                              type="button"
                              onClick={() => setPriority((current) => (current === p.value ? null : p.value))}
                              className={`flex-1 h-10 rounded-lg text-xs font-semibold border cursor-pointer transition-colors ${
                                priority === p.value ? p.activeClass : 'border-[#E5E5E5] text-[#6F6F6F] hover:bg-slate-50'
                              }`}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[#272220] font-bold text-[11px] mb-1">วันที่เริ่ม</label>
                            <ThaiDatePicker value={startDate} onChange={setStartDate} />
                          </div>
                          <div>
                            <label className="block text-[#272220] font-bold text-[11px] mb-1">วันที่สิ้นสุด</label>
                            <ThaiDatePicker value={endDate} onChange={setEndDate} min={startDate || undefined} hasError={!dateOrderValid} />
                          </div>
                        </div>
                        {!dateOrderValid && (
                          <p className="text-xs text-red-600 mt-1.5">วันที่สิ้นสุดต้องไม่อยู่ก่อนวันที่เริ่ม</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-[#272220] font-bold text-[11px] mb-1">เตือนฉันก่อนวันสิ้นสุดโครงการ</label>
                        <DeadlineReminderField
                          days={pendingReminder ?? DEFAULT_DEADLINE_REMINDER_DAYS}
                          isDefault={pendingReminder === null}
                          onChange={setPendingReminder}
                          deadlineWord="วันสิ้นสุดโครงการ"
                          note="จะบันทึกพร้อมกับโครงการนี้"
                          warning={
                            currentUser && (ownerIds.includes(currentUser.id) || assigneeIds.includes(currentUser.id))
                              ? undefined
                              : 'เตือนเฉพาะผู้รับผิดชอบโครงการ — คุณยังไม่ได้อยู่ในรายชื่อ'
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-3 min-w-0">
                      <div>
                        <label className="block text-[#272220] font-bold text-[11px] mb-1">ผู้รับผิดชอบงาน</label>
                        <EmployeeMultiSelect
                          employees={employees.filter((emp) => !ownerIds.includes(emp.id))}
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
                          <label className="block text-[#272220] font-bold text-[11px] mb-1">สถานะ</label>
                          <Dropdown<string>
                            value={status}
                            onChange={setStatus}
                            options={[
                              ...STATUS_OPTIONS.map((s) => ({ value: s, label: STATUS_LABEL[s] })),
                              ...customStatuses.map((s) => ({ value: s.id, label: s.label })),
                            ]}
                          />
                        </div>

                        <div>
                          <label className="block text-[#272220] font-bold text-[11px] mb-1">งบประมาณ (บาท)</label>
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-[#767676]">฿</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              placeholder="เช่น 500,000"
                              value={formatThousands(budget)}
                              onChange={(e) => setBudget(e.target.value.replace(/[^\d]/g, ''))}
                              className="w-full p-2.5 pl-6 text-sm border border-[#E5E5E5] rounded-lg placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#FF6537]"
                            />
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="flex items-center gap-2 cursor-pointer mb-1">
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
                            className="w-full p-2.5 text-sm border border-[#E5E5E5] rounded-lg placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#FF6537]"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-stretch">
                    <SummarySection title="ข้อมูลโครงการ" dotColor="#FF6537" onEdit={() => setStep(1)}>
                      <SummaryRow label="ชื่อโครงการ" value={title} />
                      <SummaryRow
                        label="ประเภทโครงการ"
                        value={
                          isCustomTypeSelected
                            ? (customTypeName.trim() ? `${customTypeName.trim()} (${customTypeAbbrev.trim() || '?'})` : 'ไม่ระบุ')
                            : type ? `${PROJECT_TYPE_META[type].label} (${type})` : 'ไม่ระบุ'
                        }
                      />
                      <SummaryRow label="ตัวย่อชื่อโครงการ" value={abbreviation || 'ไม่ระบุ'} />
                      {isSubProject && (
                        <SummaryRow
                          label="โครงการหลัก"
                          value={topLevelProjects.find((p) => p.id === parentProjectId)?.title ?? 'ไม่ระบุ'}
                        />
                      )}
                      <SummaryTextBlock label="รายละเอียด" text={description} />
                    </SummarySection>

                    <SummarySection title="รายละเอียดเพิ่มเติม" dotColor="#94A3B8" onEdit={() => setStep(2)}>
                      <SummaryRow
                        label="ผู้รับผิดชอบหลัก"
                        value={
                          ownerEmps.length > 0 ? (
                            <span className="flex items-center justify-end">
                              {ownerEmps.slice(0, 3).map((emp, idx) => (
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
                                      className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[11px] font-bold ring-2 ring-white ${idx > 0 ? '-ml-2' : ''}`}
                                      style={{ backgroundColor: getAvatarColor(displayName(emp)) }}
                                    >
                                      {displayName(emp).trim().charAt(0).toUpperCase()}
                                    </span>
                                  </Tooltip>
                                )
                              ))}
                              {ownerEmps.length > 3 && (
                                <span className="ml-1.5 text-[11px] font-medium text-[#6F6F6F]">+{ownerEmps.length - 3} คน</span>
                              )}
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
                                      className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[11px] font-bold ring-2 ring-white ${idx > 0 ? '-ml-2' : ''}`}
                                      style={{ backgroundColor: getAvatarColor(displayName(emp)) }}
                                    >
                                      {displayName(emp).trim().charAt(0).toUpperCase()}
                                    </span>
                                  </Tooltip>
                                )
                              ))}
                              {assigneeEmps.length > 3 && (
                                <span className="ml-1.5 text-[11px] font-medium text-[#6F6F6F]">+{assigneeEmps.length - 3} คน</span>
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
                      <p className="lg:col-span-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{formError}</p>
                    )}
                  </div>
                )}
              </div>

              <div className="shrink-0 px-5 pt-3 pb-4 flex items-center gap-3">
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
