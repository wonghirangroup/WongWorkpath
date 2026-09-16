import { CustomProjectStatus } from './types';
import { STATUS_LABEL, PROJECT_STATUS_OPTIONS } from './statusMeta';

// A plain string (not a closed union) since a project's status — and therefore a filter tab for
// it — can be a user-created custom status id, not just one of the 7 built-ins.
export type ProjectFilter = string;

const BASE_TABS: { value: ProjectFilter; label: string }[] = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'near_deadline', label: 'ใกล้ครบกำหนด' },
  ...PROJECT_STATUS_OPTIONS.map((s) => ({ value: s as ProjectFilter, label: STATUS_LABEL[s] })),
];

interface ProjectFilterTabsProps {
  active: ProjectFilter;
  onChange: (filter: ProjectFilter) => void;
  hasNearDeadline: boolean;
  customStatuses: CustomProjectStatus[];
}

// Matches the segmented pill tab switcher used in EmployeeManagement.tsx
// (bg-white border border-slate-200 rounded-xl p-1, active bg-[#F4F4F5] text-[#272220]).
export default function ProjectFilterTabs({ active, onChange, hasNearDeadline, customStatuses }: ProjectFilterTabsProps) {
  const tabs = [...BASE_TABS, ...customStatuses.map((s) => ({ value: s.id, label: s.label }))];
  return (
    <div className="flex items-center gap-0.5 bg-white border border-slate-200 rounded-xl p-1 w-fit max-w-full overflow-x-auto scrollbar-none">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          onClick={() => onChange(tab.value)}
          className={`flex items-center gap-1.5 px-3.5 h-8 rounded-lg text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6537] focus-visible:ring-offset-1 ${
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
