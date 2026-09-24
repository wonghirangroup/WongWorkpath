import { useEffect, useLayoutEffect, useRef, useState, FormEvent, KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Bell, ChevronDown, Plus, X } from 'lucide-react';
import { computePanelPlacement, PanelPlacement } from '../lib/floatingPanel';
import { useAppData } from '../context/AppDataContext';
import {
  DEFAULT_DEADLINE_REMINDER_DAYS,
  MAX_REMINDER_COUNT,
  REMINDER_PRESETS,
  REMINDER_UNIT_LABEL,
  ReminderLimit,
  ReminderUnit,
  formatReminderLead,
  normalizeReminderDays,
  parseCustomReminder,
  reminderKey,
  summarizeReminderLeads,
} from '../lib/deadlineReminders';

interface DeadlineReminderFieldProps {
  // The lead times in force for this item right now (the person's own choice, else the default).
  days: number[];
  // True while the person hasn't chosen anything for this item, so the default applies.
  isDefault: boolean;
  // Called with the new list, or null to go back to the default.
  onChange: (days: number[] | null) => void;
  // What the deadline is called here: 'กำหนดส่ง' (a task) or 'วันสิ้นสุด' (a project).
  deadlineWord: string;
  // Shown inside the panel: how/when the choice is saved.
  note?: string;
  // Shown under the trigger (amber) only when it matters — e.g. this person isn't on the item, so the
  // reminder will never reach them.
  warning?: string;
  // The longest lead time this item's own time frame allows (see reminderLimit): choices beyond it can't
  // be added. null = no deadline set yet, so there's nothing to remind about; undefined = no limit.
  limit?: ReminderLimit | null;
  disabled?: boolean;
}

const UNITS: ReminderUnit[] = ['day', 'week', 'month'];
const PANEL_WIDTH = 344;

const chipBase = 'h-8 px-3 rounded-full text-[13px] font-semibold border transition-colors cursor-pointer inline-flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6537] focus-visible:ring-offset-1';
const chipOn = 'bg-[#FF6537] border-[#FF6537] text-white';
const chipOff = 'bg-white border-slate-200 text-[#6F6F6F] hover:bg-slate-50';
const chipBlocked = 'bg-slate-50 border-slate-100 text-[#B0B0B0] cursor-not-allowed';
// Chosen earlier but longer than the time frame allows now (its dates were shortened): it's ignored, so
// it's shown as such and can still be taken off.
const chipOver = 'bg-amber-50 border-amber-300 text-amber-800';

// "เตือนฉันก่อนกำหนด" for ONE task or project, shown inside its own modal. It's a single input-height
// button (so it slots into the modals' no-scroll layouts without adding a tall block) that opens a small
// floating panel: quick choices (1 วัน … 3 เดือน, several at once), or a custom length. The choice is
// personal — it only changes when *this person* is reminded, never anyone else's, so it needs nobody's
// approval. Nothing chosen = the app default (a reminder when 2 days are left).
export default function DeadlineReminderField({ days, isDefault, onChange, deadlineWord, note, warning, limit, disabled = false }: DeadlineReminderFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [placement, setPlacement] = useState<PanelPlacement>({ left: 0, width: 0, openUpward: false, maxHeight: 320 });
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState<ReminderUnit>('day');
  const [error, setError] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!isOpen || !triggerRef.current) return;
    const p = computePanelPlacement(triggerRef.current.getBoundingClientRect(), 360);
    const width = Math.max(p.width, PANEL_WIDTH);
    setPlacement({ ...p, width, left: Math.max(12, Math.min(p.left, window.innerWidth - width - 12)) });
  }, [isOpen]);

  const closePanel = () => {
    setIsOpen(false);
    setError('');
    triggerRef.current?.focus();
  };

  // Same dismissal rules as the app's other floating lists: an outside click closes it, and so does any
  // scroll/resize happening outside the panel (it's positioned once, from a measurement).
  useEffect(() => {
    if (!isOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    const close = (e: Event) => {
      if (panelRef.current && e.target instanceof Node && panelRef.current.contains(e.target)) return;
      setIsOpen(false);
    };
    // Escape closes just this panel — not the modal it sits in, whose own Escape handler is a plain
    // document listener. Listening here in the capture phase (and stopping the event) works wherever focus
    // is: removing a chip unmounts the button that had focus, so the key then lands on <body>, outside
    // this component's React tree, where an onKeyDown on the wrapper would never see it.
    const onEscape = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      closePanel();
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onEscape, true);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onEscape, true);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [isOpen]);

  // Key presses in here belong to this control alone: Enter must not reach the modal's form (React bubbles
  // events from a portal up through its parent component, and CreateProjectModal advances its wizard on
  // any Enter). Escape is handled by the document-level listener above.
  const onKeyDown = (e: KeyboardEvent) => {
    e.stopPropagation();
  };

  const noDeadline = limit === null;
  const maxDays = limit ? limit.maxDays : undefined; // undefined = no limit
  const isOver = (d: number) => maxDays !== undefined && d > maxDays;
  const overMessage = maxDays !== undefined && maxDays < 1
    ? 'ช่วงเวลาสั้นเกินไปที่จะตั้งเตือนล่วงหน้า'
    : `ตั้งได้ไม่เกิน ${maxDays} วัน ตามช่วงวันที่ที่กำหนดไว้`;

  // What's actually in force. The app default is the system's own and is never trimmed — but it isn't
  // offered as a "choice" either when it doesn't fit, so the first pick starts from what fits.
  const listed = isDefault ? days.filter((d) => !isOver(d)) : days;
  const presetDays = REMINDER_PRESETS.map((p) => p.days);
  const customDays = listed.filter((d) => !presetDays.includes(d));
  const atLimit = listed.length >= MAX_REMINDER_COUNT;
  const hasOver = listed.some(isOver);
  const shownSummary = summarizeReminderLeads(isDefault ? days : listed.filter((d) => !isOver(d)));

  const toggle = (value: number) => {
    setError('');
    if (listed.includes(value)) onChange(listed.filter((d) => d !== value));
    else if (isOver(value)) setError(overMessage);
    else if (atLimit) setError(`เลือกได้สูงสุด ${MAX_REMINDER_COUNT} ช่วง`);
    else onChange(normalizeReminderDays([...listed, value]));
  };

  const addCustom = (e: FormEvent) => {
    e.preventDefault();
    e.stopPropagation(); // this form lives in a portal, but React still bubbles its submit to the modal's own <form>
    const parsed = parseCustomReminder(amount, unit);
    if ('error' in parsed) return setError(parsed.error);
    if (isOver(parsed.days)) return setError(overMessage);
    if (listed.includes(parsed.days)) return setError(`มี "${formatReminderLead(parsed.days)}" อยู่แล้ว`);
    if (atLimit) return setError(`เลือกได้สูงสุด ${MAX_REMINDER_COUNT} ช่วง`);
    setError('');
    setAmount('');
    onChange(normalizeReminderDays([...listed, parsed.days]));
  };

  return (
    <div onKeyDown={onKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled || noDeadline}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((v) => !v)}
        className={`w-full h-10.5 flex items-center gap-2 px-3 bg-white border border-[#E5E5E5] rounded-lg text-sm text-left focus:outline-none focus:border-[#FF6537] ${
          disabled || noDeadline ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-slate-50'
        } ${isOpen ? 'border-[#FF6537]' : ''}`}
      >
        <Bell size={15} className="text-[#FF6537] shrink-0" aria-hidden />
        {noDeadline ? (
          <span className="flex-1 min-w-0 truncate text-[#6F6F6F]">ใส่{deadlineWord}ก่อน จึงตั้งเตือนได้</span>
        ) : (
          <span className="flex-1 min-w-0 truncate text-slate-800">{shownSummary}</span>
        )}
        {isDefault && !noDeadline && <span className="shrink-0 text-[11px] font-semibold text-[#6F6F6F] bg-slate-100 rounded-full px-2 py-0.5">ค่าเริ่มต้น</span>}
        {!noDeadline && <ChevronDown size={14} className={`text-[#FF6537] shrink-0 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} aria-hidden />}
      </button>
      {warning && <p className="text-[11px] text-amber-700 mt-1">{warning}</p>}

      {createPortal(
        <AnimatePresence>
          {isOpen && !noDeadline && (
            <motion.div
              ref={panelRef}
              role="dialog"
              aria-label={`เตือนฉันก่อน${deadlineWord}`}
              onKeyDown={onKeyDown}
              initial={{ opacity: 0, y: placement.openUpward ? 4 : -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: placement.openUpward ? 4 : -4 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              style={{
                position: 'fixed',
                top: placement.top,
                bottom: placement.bottom,
                left: placement.left,
                width: placement.width,
                maxHeight: placement.maxHeight,
              }}
              className="z-60 bg-white rounded-2xl border border-slate-100 shadow-xl overflow-y-auto p-4"
            >
              <p className="text-[13px] font-bold text-[#272220]">เตือนฉันก่อนถึง{deadlineWord}</p>
              <p className="text-[11px] text-[#6F6F6F] mt-0.5">เลือกได้หลายช่วง — เป็นค่าของคุณเอง ไม่กระทบคนอื่น{note ? ` · ${note}` : ''}</p>

              {limit && (
                <p className="text-[11px] font-semibold text-[#272220] mt-1">
                  {limit.maxDays < 1
                    ? 'ช่วงเวลาสั้นเกินไป จึงตั้งเตือนล่วงหน้าเองไม่ได้'
                    : `ตั้งได้ไม่เกิน ${limit.maxDays} วัน — ตามช่วงตั้งแต่${limit.fromToday ? 'วันนี้' : 'วันที่เริ่ม'}ถึง${deadlineWord}`}
                </p>
              )}

              <div role="group" aria-label="ช่วงเวลาที่เตือน" className="flex flex-wrap gap-1.5 mt-3">
                {REMINDER_PRESETS.map((p) => {
                  const on = listed.includes(p.days);
                  const over = isOver(p.days);
                  return (
                    <button
                      key={p.days}
                      type="button"
                      aria-pressed={on}
                      disabled={over && !on}
                      title={over ? (on ? 'เกินช่วงวันที่ — จะไม่ถูกใช้ กดเพื่อเอาออก' : overMessage) : undefined}
                      onClick={() => toggle(p.days)}
                      className={`${chipBase} ${over ? (on ? chipOver : chipBlocked) : on ? chipOn : chipOff}`}
                    >
                      {p.label}
                    </button>
                  );
                })}
                {customDays.map((d) => (
                  <button
                    key={d}
                    type="button"
                    aria-label={`เอา "${formatReminderLead(d)}" ออก`}
                    title={isOver(d) ? 'เกินช่วงวันที่ — จะไม่ถูกใช้ กดเพื่อเอาออก' : undefined}
                    onClick={() => toggle(d)}
                    className={`${chipBase} ${isOver(d) ? chipOver : chipOn}`}
                  >
                    {formatReminderLead(d)}
                    <X size={13} aria-hidden />
                  </button>
                ))}
              </div>

              <form onSubmit={addCustom} className="flex flex-wrap items-center gap-1.5 mt-3">
                <span className="text-[12px] font-semibold text-[#272220]">กำหนดเอง</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="เช่น 14"
                  aria-label="จำนวนที่ต้องการให้เตือนล่วงหน้า"
                  className="w-20 h-8 px-2.5 border border-[#E5E5E5] rounded-lg text-sm placeholder:text-[#767676] focus:outline-none focus:border-[#FF6537]"
                />
                <div role="group" aria-label="หน่วย" className="inline-flex rounded-lg border border-[#E5E5E5] overflow-hidden">
                  {UNITS.map((u) => (
                    <button
                      key={u}
                      type="button"
                      aria-pressed={unit === u}
                      onClick={() => setUnit(u)}
                      className={`h-8 px-2.5 text-[13px] font-semibold cursor-pointer transition-colors ${unit === u ? 'bg-[#272220] text-white' : 'bg-white text-[#6F6F6F] hover:bg-slate-50'}`}
                    >
                      {REMINDER_UNIT_LABEL[u]}
                    </button>
                  ))}
                </div>
                <button
                  type="submit"
                  disabled={!amount.trim()}
                  className={`h-8 px-3 rounded-lg text-[13px] font-bold inline-flex items-center gap-1 text-white transition-colors ${
                    amount.trim() ? 'bg-[#FF6537] hover:bg-[#e6572c] cursor-pointer' : 'bg-[#F68C6C] cursor-not-allowed'
                  }`}
                >
                  <Plus size={14} aria-hidden /> เพิ่ม
                </button>
              </form>

              {hasOver && <p className="text-[11px] text-amber-700 mt-2">ช่วงสีเหลืองยาวเกินช่วงวันที่ตอนนี้ จึงไม่ถูกใช้เตือน — กดเพื่อเอาออกได้</p>}
              {error && <p role="alert" className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mt-3">{error}</p>}

              <div className="mt-3 space-y-1 text-[12px] text-[#6F6F6F]">
                {listed.length === 0 && !isDefault && <p>ไม่ได้เลือกช่วงใดเลย — จะไม่เตือนล่วงหน้า (ยังเตือนเมื่อเลยกำหนดแล้ว)</p>}
                {isDefault ? (
                  <p>ค่าเริ่มต้นของระบบ: เตือนเมื่อเหลือ {DEFAULT_DEADLINE_REMINDER_DAYS.map(formatReminderLead).join(', ')} — เลือกช่วงด้านบนเพื่อเปลี่ยน</p>
                ) : (
                  <button type="button" onClick={() => { setError(''); onChange(null); }} className="font-semibold text-[#FF6537] hover:underline cursor-pointer">
                    กลับเป็นค่าเริ่มต้น
                  </button>
                )}
              </div>

              <div className="mt-3 flex justify-end">
                <button type="button" onClick={closePanel} className="h-8 px-4 rounded-lg border border-slate-200 text-[13px] font-semibold text-[#272220] hover:bg-slate-50 cursor-pointer">
                  เสร็จ
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}

// Wires a DeadlineReminderField to the logged-in person's saved choice for one existing project/task.
// Changes are saved straight away (and never touch the approval flow — it's a personal preference).
export function useSavedReminder(kind: 'task' | 'project', itemId: string | undefined) {
  const { deadlineReminders, handleSetDeadlineReminder } = useAppData();
  const chosen = itemId ? deadlineReminders[reminderKey(kind, itemId)] : undefined;
  return {
    days: chosen ?? DEFAULT_DEADLINE_REMINDER_DAYS,
    isDefault: chosen === undefined,
    onChange: (next: number[] | null) => {
      if (itemId) handleSetDeadlineReminder(kind, itemId, next);
    },
  };
}
