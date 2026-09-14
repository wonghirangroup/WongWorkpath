import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { SlidersHorizontal } from 'lucide-react';
import { DashboardWidgetPrefs, DashboardWidgetVisibility } from './widgetPrefs';

const WIDGET_LABELS: { key: keyof DashboardWidgetVisibility; label: string }[] = [
  { key: 'summaryTable', label: 'สรุปโครงการ (ตาราง)' },
  { key: 'progressGauge', label: 'ความคืบหน้าภาพรวม' },
  { key: 'myTasks', label: 'งานของฉันที่ใกล้ครบกำหนด' },
  { key: 'workload', label: 'ใครทำอะไรอยู่บ้าง' },
];

interface WidgetSettingsMenuProps {
  prefs: DashboardWidgetPrefs;
  onChange: (next: DashboardWidgetPrefs) => void;
}

// Same popover shell as ProjectBoard's SortMenu (outside-click close via a mousedown listener,
// motion fade+slide panel) — the one addition here is checkboxes instead of single-select rows,
// so an executive can hide/show individual dashboard blocks and switch the progress/investment
// widgets into a per-department grouped view, all persisted to localStorage.
export default function WidgetSettingsMenu({ prefs, onChange }: WidgetSettingsMenuProps) {
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

  const toggleWidget = (key: keyof DashboardWidgetVisibility) => {
    onChange({ ...prefs, visible: { ...prefs.visible, [key]: !prefs.visible[key] } });
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="bg-white border border-slate-200 hover:bg-slate-50 text-[#272220] text-sm font-semibold px-4 h-10 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap transition-colors"
        id="btn-widget-settings"
      >
        <SlidersHorizontal size={16} /> ปรับแต่งวิดเจ็ต
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-1.5 w-64 bg-white border border-slate-200 rounded-xl shadow-lg py-2 z-20"
          >
            <p className="px-3.5 py-1 text-[11px] font-bold text-[#A0A0A0] uppercase tracking-wide">แสดง/ซ่อนวิดเจ็ต</p>
            {WIDGET_LABELS.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 px-3.5 py-2 text-sm text-[#272220] hover:bg-[#FEFAF9] cursor-pointer">
                <input
                  type="checkbox"
                  checked={prefs.visible[key]}
                  onChange={() => toggleWidget(key)}
                  className="w-3.5 h-3.5 accent-[#FF6537] cursor-pointer shrink-0"
                />
                {label}
              </label>
            ))}
            <div className="my-1.5 border-t border-slate-100" />
            <label className="flex items-center gap-2 px-3.5 py-2 text-sm text-[#272220] hover:bg-[#FEFAF9] cursor-pointer">
              <input
                type="checkbox"
                checked={prefs.groupByDepartment}
                onChange={() => onChange({ ...prefs, groupByDepartment: !prefs.groupByDepartment })}
                className="w-3.5 h-3.5 accent-[#FF6537] cursor-pointer shrink-0"
              />
              จัดกลุ่มตามแผนก
            </label>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
