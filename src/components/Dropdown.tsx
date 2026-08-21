import { useEffect, useId, useRef, useState, KeyboardEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown } from 'lucide-react';

interface DropdownProps<T extends string> {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  placeholder?: string;
  // 'compact' matches a page-level search/filter row; 'cozy' matches h-[44px] text inputs
  // inside a create/edit modal — the two contexts sit next to differently-sized siblings.
  size?: 'compact' | 'cozy';
}

// Reusable button + floating list dropdown (rounded card, subtle tinted highlight on the selected row)
// Full keyboard support (Arrow Up/Down, Enter, Escape) + ARIA combobox/listbox roles, shared by every
// page-level filter dropdown (Credential Vault, Doc Vault, ...) so they all behave identically.
export default function Dropdown<T extends string>({ value, options, onChange, placeholder, size = 'compact' }: DropdownProps<T>) {
  const trigger = size === 'cozy'
    ? { height: 'h-11', text: 'text-base', padding: 'pl-4 pr-4' }
    : { height: 'h-10', text: 'text-[13px]', padding: 'pl-3.5 pr-3.5' };
  const optionStyle = size === 'cozy'
    ? { padding: 'px-4 py-2.5', text: 'text-base' }
    : { padding: 'px-3.5 py-2', text: 'text-sm' };
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
    <div className="relative" ref={ref}>
      <button
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        onClick={() => (isOpen ? setIsOpen(false) : openDropdown())}
        onKeyDown={handleTriggerKeyDown}
        className={`w-full ${trigger.height} flex items-center justify-between ${trigger.padding} bg-white border border-[#BAB7B7] ${trigger.text} font-normal cursor-pointer focus:outline-none focus:border-[#FF6537] ${
          isOpen ? 'rounded-t-xl rounded-b-none' : 'rounded-xl'
        }`}
      >
        <span className={`whitespace-nowrap ${selectedLabel ? '' : 'text-slate-400'}`}>{selectedLabel || placeholder}</span>
        <ChevronDown
          size={size === 'cozy' ? 16 : 14}
          className={`text-[#FF6537] transition-transform duration-150 ease-out ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            id={listboxId}
            role="listbox"
            initial={{ opacity: 0, scaleY: 0.9, y: -4 }}
            animate={{ opacity: 1, scaleY: 1, y: 0 }}
            exit={{ opacity: 0, scaleY: 0.9, y: -4 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="absolute z-30 mt-0.5 w-full max-h-60 origin-top bg-white rounded-t-none rounded-b-2xl shadow-xl overflow-y-auto"
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
      </AnimatePresence>
    </div>
  );
}
