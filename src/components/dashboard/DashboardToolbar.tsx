import { Plus, Download } from 'lucide-react';
import Dropdown from '../Dropdown';
import WidgetSettingsMenu from './WidgetSettingsMenu';
import { DashboardWidgetPrefs } from './widgetPrefs';

interface DashboardToolbarProps {
  onAddTask: () => void;
  onExport: () => void;
  departmentFilter: string;
  onDepartmentFilterChange: (value: string) => void;
  orgSections: string[];
  widgetPrefs: DashboardWidgetPrefs;
  onWidgetPrefsChange: (next: DashboardWidgetPrefs) => void;
}

// Same toolbar shape as every other module (Project Board, Doc Vault, Credential Vault): filters
// on the left, primary action right-aligned via lg:ml-auto, sitting directly on the page
// background — no separate hero/banner card, since the Header above it already carries the page
// title. The dashboard used to open with a dark gradient "welcome" hero that nothing else in the
// app has; that stood out as visually inconsistent rather than as an intentional accent.
export default function DashboardToolbar({ onAddTask, onExport, departmentFilter, onDepartmentFilterChange, orgSections, widgetPrefs, onWidgetPrefsChange }: DashboardToolbarProps) {
  return (
    <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
      <div className="w-full lg:w-52">
        <Dropdown
          value={departmentFilter}
          onChange={onDepartmentFilterChange}
          options={[{ value: 'All', label: 'ทุกแผนก' }, ...orgSections.map((s) => ({ value: s, label: s }))]}
        />
      </div>

      <div className="flex items-center gap-3 print:hidden lg:ml-auto">
        <WidgetSettingsMenu prefs={widgetPrefs} onChange={onWidgetPrefsChange} />
        <button
          type="button"
          onClick={onExport}
          className="bg-white border border-slate-200 hover:bg-slate-50 text-[#272220] text-sm font-semibold px-4 h-10 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap transition-colors"
        >
          <Download size={16} />
          Export
        </button>
        <button
          type="button"
          onClick={onAddTask}
          className="bg-[#FF6537] hover:opacity-90 text-white text-sm font-bold px-4 h-10 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap transition-colors"
          id="btn-add-task-dash"
        >
          <Plus size={16} />
          สร้างงานใหม่
        </button>
      </div>
    </div>
  );
}
