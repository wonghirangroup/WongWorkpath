import { useEffect, useId, useLayoutEffect, useRef, useState, KeyboardEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown } from 'lucide-react';
import { computePanelPlacement, PANEL_MAX_HEIGHT, PanelPlacement } from '../lib/floatingPanel';

interface DropdownProps<T extends string> {
  value: T;
  // ReactNode (not just string) so a special option — e.g. "อื่นๆ ระบุ..." with its own + icon —
  // can render more than plain text; every existing caller passing a plain string still works
  // unchanged, since JSX renders a string child exactly the same way.
  options: { value: T; label: ReactNode }[];
  onChange: (value: T) => void;
  placeholder?: string;
  // 'compact' matches a page-level search/filter row; 'cozy' matches h-[44px] text inputs
  // inside a create/edit modal — the two contexts sit next to differently-sized siblings.
  size?: 'compact' | 'cozy';
  disabled?: boolean;
}

// Reusable button + floating list dropdown (rounded card, subtle tinted highlight on the selected row)
// Full keyboard support (Arrow Up/Down, Enter, Escape) + ARIA combobox/listbox roles, shared by every
// page-level filter dropdown (Credential Vault, Doc Vault, ...) so they all behave identically.
//
// The floating panel renders through a portal into document.body, positioned via the trigger's own
// getBoundingClientRect() — a plain in-flow absolute panel used to get silently clipped whenever the
// trigger sat inside a horizontally-scrolling container (e.g. ProjectTable's overflow-x-auto wrapper),
// since setting overflow-x forces overflow-y to compute to auto too, per the CSS spec. Escaping to a
// portal sidesteps that entirely, at the cost of having to reposition by hand instead of relying on
// normal document flow.
export default function Dropdown<T extends string>({ value, options, onChange, placeholder, size = 'compact', disabled = false }: DropdownProps<T>) {
  const trigger = size === 'cozy'
    ? { height: 'h-11', text: 'text-base', padding: 'pl-4 pr-4' }
    : { height: 'h-10', text: 'text-[13px]', padding: 'pl-3.5 pr-3.5' };
  const optionStyle = size === 'cozy'
    ? { padding: 'px-4 py-2.5', text: 'text-base' }
    : { padding: 'px-3.5 py-2', text: 'text-sm' };
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [panelRect, setPanelRect] = useState<PanelPlacement>({
    left: 0, width: 0, openUpward: false, maxHeight: PANEL_MAX_HEIGHT,
  });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  // Flips the panel above the trigger instead of below it whenever there isn't room to open
  // downward (e.g. a field near the bottom of a tall scrollable modal) but there IS more room
  // above, keeps a gap from the viewport edge, and shrinks to the room left when neither side has
  // the full height to spare — see computePanelPlacement in lib/floatingPanel.ts (shared with
  // EmployeeMultiSelect so both floating lists follow identical rules).
  useLayoutEffect(() => {
    if (!isOpen || !triggerRef.current) return;
    setPanelRect(computePanelPlacement(triggerRef.current.getBoundingClientRect()));
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // The panel is positioned from a one-off measurement taken when it opens, not continuously
  // tracked — simplest correct fix is to close instead of drifting out of place if the trigger's
  // own position changes underneath it (scrolling the page, or a horizontally-scrolling ancestor
  // like ProjectTable's wrapper). `true` = capture phase, so this still fires for a scroll inside
  // a nested scrollable container, which wouldn't otherwise bubble a scroll event to window — but
  // that also caught scrolling the panel's OWN option list (it's `max-h-60 overflow-y-auto`),
  // closing the dropdown on every attempt to scroll down to a lower option. Skip closing when the
  // scroll happened inside the panel itself; every other scroll (the page, or an ancestor of the
  // trigger) still closes it as before.
  useEffect(() => {
    if (!isOpen) return;
    const close = (e: Event) => {
      if (panelRef.current && e.target instanceof Node && panelRef.current.contains(e.target)) return;
      setIsOpen(false);
    };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [isOpen]);

  const selectedLabel = options.find((o) => o.value === value)?.label;
  const selectedIndex = options.findIndex((o) => o.value === value);

  const openDropdown = () => {
    setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setIsOpen(true);
  };

  const handleTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openDropdown();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % options.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + options.length) % options.length);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (highlightedIndex >= 0) {
        onChange(options[highlightedIndex].value);
        setIsOpen(false);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        disabled={disabled}
        onClick={() => !disabled && (isOpen ? setIsOpen(false) : openDropdown())}
        onKeyDown={disabled ? undefined : handleTriggerKeyDown}
        className={`w-full ${trigger.height} flex items-center justify-between ${trigger.padding} bg-white border border-[#BAB7B7] ${trigger.text} font-normal focus:outline-none focus:border-[#FF6537] ${
          disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
        } ${
          isOpen ? (panelRect.openUpward ? 'rounded-b-xl rounded-t-none' : 'rounded-t-xl rounded-b-none') : 'rounded-xl'
        }`}
      >
        <span className={`whitespace-nowrap ${selectedLabel ? '' : 'text-slate-500'}`}>{selectedLabel || placeholder}</span>
        <ChevronDown
          size={size === 'cozy' ? 16 : 14}
          className={`text-[#FF6537] transition-transform duration-150 ease-out ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {createPortal(
        <AnimatePresence>
          {isOpen && (
            <motion.div
              ref={panelRef}
              id={listboxId}
              role="listbox"
              initial={{ opacity: 0, scaleY: 0.9, y: panelRect.openUpward ? 4 : -4 }}
              animate={{ opacity: 1, scaleY: 1, y: 0 }}
              exit={{ opacity: 0, scaleY: 0.9, y: panelRect.openUpward ? 4 : -4 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              style={{
                position: 'fixed',
                top: panelRect.top,
                bottom: panelRect.bottom,
                left: panelRect.left,
                width: panelRect.width,
                maxHeight: panelRect.maxHeight,
              }}
              className={`z-60 bg-white shadow-xl overflow-y-auto ${
                panelRect.openUpward ? 'origin-bottom rounded-b-none rounded-t-2xl' : 'origin-top rounded-t-none rounded-b-2xl'
              }`}
            >
              {options.map((option, index) => (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  tabIndex={-1}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={`w-full text-left ${optionStyle.padding} ${optionStyle.text} cursor-pointer ${
                    index === highlightedIndex
                      ? 'bg-[#FF6537] text-white font-semibold'
                      : option.value === value
                        ? 'bg-[#FFF1EC] text-slate-900'
                        : 'text-slate-800 hover:bg-[#FEFAF9]'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
