import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X } from 'lucide-react';
import { formatThaiDateShort } from '../lib/datetime';
import { useEscapeToClose } from '../lib/useEscapeToClose';

const THAI_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const THAI_WEEKDAYS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function toISO(year: number, month: number, day: number): string {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

function parseISO(iso: string): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]) - 1, day: Number(m[3]) };
}

interface ThaiDatePickerProps {
  value: string; // ISO yyyy-mm-dd, or '' for unset
  onChange: (value: string) => void;
  min?: string; // ISO yyyy-mm-dd
  max?: string;
  placeholder?: string;
  hasError?: boolean;
  // Matches a page-level toolbar filter's `h-10 px-3` sizing instead of a modal form field's
  // `p-2.5` — same two-context split as Dropdown.tsx's own `size` prop.
  compact?: boolean;
}

// Drop-in replacement for `<input type="date">` — the native control renders the browser's own
// (Gregorian, `mm/dd/yyyy`) chrome, which stood out as the one place in an otherwise
// Buddhist-Era-Thai-dated app where the user suddenly sees English/Gregorian formatting mid-form.
// Built the same way Dropdown.tsx already solves "floating panel next to a form field": a portal
// to document.body positioned from the trigger's own measured rect, so it can't get clipped by a
// scrolling modal body, plus the same outside-click/Escape/scroll-closes conventions.
export default function ThaiDatePicker({ value, onChange, min, max, placeholder = 'เลือกวันที่', hasError, compact }: ThaiDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [panelRect, setPanelRect] = useState<{ left: number; top?: number; bottom?: number; openUpward: boolean }>({
    left: 0, openUpward: false,
  });
  const parsedValue = parseISO(value);
  const today = new Date();
  const [viewYear, setViewYear] = useState(parsedValue?.year ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsedValue?.month ?? today.getMonth());
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEscapeToClose(isOpen, () => setIsOpen(false));

  // Flips the calendar above the trigger instead of below it whenever there isn't room to open
  // downward (e.g. a date field near the bottom of a tall scrollable modal) but there IS room
  // above — otherwise the ~330px-tall panel would render partly below the viewport/modal edge
  // with no way to reach the later rows or the "วันนี้"/"ล้างค่า" footer.
  useLayoutEffect(() => {
    if (!isOpen || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const panelHeight = 340;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUpward = spaceBelow < panelHeight && spaceAbove > spaceBelow;
    setPanelRect(
      openUpward
        ? { bottom: window.innerHeight - rect.top + 4, left: rect.left, openUpward }
        : { top: rect.bottom + 4, left: rect.left, openUpward }
    );
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const close = () => setIsOpen(false);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [isOpen]);

  const openPicker = () => {
    if (parsedValue) {
      setViewYear(parsedValue.year);
      setViewMonth(parsedValue.month);
    }
    setIsOpen(true);
  };

  const goToMonth = (delta: number) => {
    let y = viewYear;
    let m = viewMonth + delta;
    if (m < 0) { m = 11; y -= 1; }
    else if (m > 11) { m = 0; y += 1; }
    setViewYear(y);
    setViewMonth(m);
  };

  // 6 full weeks (42 cells) so the grid height never jumps between months — leading/trailing
  // days from the adjacent month are shown muted and are not selectable, keeping "which month am
  // I looking at" unambiguous rather than letting a click silently jump the view.
  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();
  const cells: { day: number; iso: string; inMonth: boolean }[] = [];
  for (let i = 0; i < startWeekday; i++) {
    const day = daysInPrevMonth - startWeekday + 1 + i;
    const m = viewMonth === 0 ? 11 : viewMonth - 1;
    const y = viewMonth === 0 ? viewYear - 1 : viewYear;
    cells.push({ day, iso: toISO(y, m, day), inMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ day, iso: toISO(viewYear, viewMonth, day), inMonth: true });
  }
  while (cells.length < 42) {
    const day = cells.length - startWeekday - daysInMonth + 1;
    const m = viewMonth === 11 ? 0 : viewMonth + 1;
    const y = viewMonth === 11 ? viewYear + 1 : viewYear;
    cells.push({ day, iso: toISO(y, m, day), inMonth: false });
  }

  const todayISO = toISO(today.getFullYear(), today.getMonth(), today.getDate());
  const isDisabled = (iso: string) => (min && iso < min) || (max && iso > max);

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (isOpen ? setIsOpen(false) : openPicker())}
        className={`w-full text-sm border rounded-lg focus:outline-none focus:border-[#FF6537] bg-white text-left flex items-center justify-between gap-2 cursor-pointer ${
          compact ? 'h-10 px-3' : 'p-2.5'
        } ${hasError ? 'border-red-400' : 'border-[#E5E5E5]'}`}
      >
        <span className={value ? 'text-[#272220]' : 'text-[#B0B0B0]'}>{value ? formatThaiDateShort(value) : placeholder}</span>
        <span className="flex items-center gap-1 shrink-0">
          {value && (
            <span
              role="button"
              tabIndex={-1}
              onClick={(e) => { e.stopPropagation(); onChange(''); }}
              className="text-slate-300 hover:text-slate-500 cursor-pointer"
              aria-label="ล้างวันที่"
            >
              <X size={13} />
            </span>
          )}
          <CalendarIcon size={14} className="text-[#A0A0A0]" />
        </span>
      </button>

      {createPortal(
        <AnimatePresence>
          {isOpen && (
            <motion.div
              ref={panelRef}
              initial={{ opacity: 0, y: panelRect.openUpward ? 6 : -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: panelRect.openUpward ? 6 : -6 }}
              transition={{ duration: 0.15 }}
              style={{ position: 'fixed', top: panelRect.top, bottom: panelRect.bottom, left: panelRect.left }}
              className="z-60 w-70 bg-white border border-slate-200 rounded-2xl shadow-xl p-3"
            >
              <div className="flex items-center justify-between mb-2 px-1">
                <button
                  type="button"
                  onClick={() => goToMonth(-1)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-[#6F6F6F] hover:bg-slate-100 cursor-pointer"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-sm font-bold text-[#272220]">
                  {THAI_MONTHS[viewMonth]} {viewYear + 543}
                </span>
                <button
                  type="button"
                  onClick={() => goToMonth(1)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-[#6F6F6F] hover:bg-slate-100 cursor-pointer"
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              <div className="grid grid-cols-7 mb-1">
                {THAI_WEEKDAYS.map((w) => (
                  <div key={w} className="text-center text-[11px] font-semibold text-[#A0A0A0] py-1">{w}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-y-0.5">
                {cells.map(({ day, iso, inMonth }) => {
                  const disabled = isDisabled(iso);
                  const isSelected = iso === value;
                  const isToday = iso === todayISO;
                  return (
                    <button
                      key={iso}
                      type="button"
                      disabled={disabled || !inMonth}
                      onClick={() => { onChange(iso); setIsOpen(false); }}
                      className={`h-8 mx-auto w-8 rounded-lg text-xs font-medium transition-colors ${
                        !inMonth
                          ? 'text-transparent cursor-default'
                          : disabled
                          ? 'text-slate-300 cursor-not-allowed'
                          : isSelected
                          ? 'bg-[#FF6537] text-white font-bold cursor-pointer'
                          : isToday
                          ? 'text-[#FF6537] font-bold border border-[#FF6537] cursor-pointer'
                          : 'text-[#272220] hover:bg-[#FEFAF9] cursor-pointer'
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>

              <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => { onChange(''); setIsOpen(false); }}
                  className="text-xs font-semibold text-[#6F6F6F] hover:text-[#272220] cursor-pointer"
                >
                  ล้างค่า
                </button>
                <button
                  type="button"
                  disabled={isDisabled(todayISO)}
                  onClick={() => { onChange(todayISO); setIsOpen(false); }}
                  className="text-xs font-semibold text-[#FF6537] hover:underline cursor-pointer disabled:text-slate-300 disabled:no-underline disabled:cursor-not-allowed"
                >
                  วันนี้
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
