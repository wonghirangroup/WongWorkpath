import { ProjectStatus } from './types';
import { STATUS_LABEL } from './statusMeta';

export type ProjectFilter = 'all' | 'near_deadline' | ProjectStatus;

const TABS: { value: ProjectFilter; label: string }[] = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'near_deadline', label: 'ใกล้ครบกำหนด' },
  { value: 'in_progress', label: STATUS_LABEL.in_progress },
  { value: 'draft', label: STATUS_LABEL.draft },
  { value: 'on_hold', label: STATUS_LABEL.on_hold },
  { value: 'completed', label: STATUS_LABEL.completed },
  { value: 'cancelled', label: STATUS_LABEL.cancelled },
];

interface ProjectFilterTabsProps {
  active: ProjectFilter;
  onChange: (filter: ProjectFilter) => void;
  hasNearDeadline: boolean;
}

// Matches the segmented pill tab switcher used in EmployeeManagement.tsx
// (bg-white border border-slate-200 rounded-xl p-1, active bg-[#F4F4F5] text-[#272220]).
export default function ProjectFilterTabs({ active, onChange, hasNearDeadline }: ProjectFilterTabsProps) {
  return (
    <div className="flex items-center gap-0.5 bg-white border border-slate-200 rounded-xl p-1 w-fit max-w-full overflow-x-auto scrollbar-none">
      {TABS.map((tab) => (
        <button
          key={tab.value}
          type="button"
          onClick={() => onChange(tab.value)}
          className={`flex items-center gap-1.5 px-3.5 h-8 rounded-lg text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
            active === tab.value ? 'bg-[#FF6537] text-white' : 'text-[#6F6F6F] hover:text-[#272220]'
          }`}
        >
          {tab.label}
          {tab.value === 'near_deadline' && hasNearDeadline && (
            <span className="relative flex w-1.5 h-1.5 shrink-0">
              <span className="absolute inline-flex w-full h-full rounded-full bg-[#F50C0C] opacity-75 animate-ping" />
              <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-[#F50C0C]" />
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
