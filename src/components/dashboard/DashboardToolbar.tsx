import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Plus, Download, ChevronDown, FileText, FileSpreadsheet } from 'lucide-react';
import Dropdown from '../Dropdown';
import WidgetSettingsMenu from './WidgetSettingsMenu';
import { DashboardWidgetPrefs } from './widgetPrefs';
import { ProjectRow } from '../projectBoard/types';

interface DashboardToolbarProps {
  onCreateProject: () => void;
  onExportCsv: () => void;
  onExportPdf: () => void;
  projectFilter: string;
  onProjectFilterChange: (value: string) => void;
  projects: ProjectRow[];
  widgetPrefs: DashboardWidgetPrefs;
  onWidgetPrefsChange: (next: DashboardWidgetPrefs) => void;
  // ผู้บริหาร-only extra filter — every other role only ever sees its own responsible projects, so
  // narrowing by department on top of that would just be a smaller version of the same thing.
  showDepartmentFilter: boolean;
  departmentFilter: string;
  onDepartmentFilterChange: (value: string) => void;
  departments: string[];
}

// Same popover shell as every other small menu in the app (SortMenu, WidgetSettingsMenu) —
// outside-click close, motion fade+slide panel — picking between the two export shapes instead of
// a single ambiguous "Export" button that only ever produced a print dialog.
function ExportMenu({ onExportCsv, onExportPdf }: { onExportCsv: () => void; onExportPdf: () => void }) {
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

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="bg-white border border-slate-200 hover:bg-slate-50 text-[#272220] text-sm font-semibold px-4 h-10 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap transition-colors"
      >
        <Download size={16} />
        Export
        <ChevronDown size={14} className={`transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-full mt-1.5 w-44 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 z-20"
          >
            <button
              type="button"
              onClick={() => { onExportCsv(); setIsOpen(false); }}
              className="w-full flex items-center gap-2 px-3.5 py-2 text-sm text-slate-800 hover:bg-[#FEFAF9] cursor-pointer"
            >
              <FileSpreadsheet size={15} className="text-[#6F6F6F]" />
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => { onExportPdf(); setIsOpen(false); }}
              className="w-full flex items-center gap-2 px-3.5 py-2 text-sm text-slate-800 hover:bg-[#FEFAF9] cursor-pointer"
            >
              <FileText size={15} className="text-[#6F6F6F]" />
              Export PDF
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Same toolbar shape as every other module (Project Board, Doc Vault, Credential Vault): filters
// on the left, primary action right-aligned via lg:ml-auto, sitting directly on the page
// background — no separate hero/banner card, since the Header above it already carries the page
// title. The dashboard used to open with a dark gradient "welcome" hero that nothing else in the
// app has; that stood out as visually inconsistent rather than as an intentional accent.
export default function DashboardToolbar({ onCreateProject, onExportCsv, onExportPdf, projectFilter, onProjectFilterChange, projects, widgetPrefs, onWidgetPrefsChange, showDepartmentFilter, departmentFilter, onDepartmentFilterChange, departments }: DashboardToolbarProps) {
  return (
    <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
      <div className="w-full lg:w-52">
        <Dropdown
          value={projectFilter}
          onChange={onProjectFilterChange}
          options={[{ value: 'All', label: 'ทุกโครงการ' }, ...projects.map((p) => ({ value: p.id, label: p.title }))]}
        />
      </div>

      {showDepartmentFilter && (
        <div className="w-full lg:w-48">
          <Dropdown
            value={departmentFilter}
            onChange={onDepartmentFilterChange}
            options={[{ value: '__all__', label: 'ทุกแผนก' }, ...departments.map((d) => ({ value: d, label: d }))]}
          />
        </div>
      )}

      <div className="flex items-center gap-3 print:hidden lg:ml-auto">
        <WidgetSettingsMenu prefs={widgetPrefs} onChange={onWidgetPrefsChange} />
        <ExportMenu onExportCsv={onExportCsv} onExportPdf={onExportPdf} />
        <button
          type="button"
          onClick={onCreateProject}
          className="bg-[#FF6537] hover:opacity-90 text-white text-sm font-bold px-4 h-10 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap transition-colors"
          id="btn-create-project-dash"
        >
          <Plus size={16} />
          สร้างโครงการใหม่
        </button>
      </div>
    </div>
  );
}
