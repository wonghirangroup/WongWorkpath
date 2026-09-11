import { ProjectStatus } from './types';
import { STATUS_LABEL, STATUS_DOT, STATUS_ICON } from './statusMeta';

const ORDER: ProjectStatus[] = ['in_progress', 'completed', 'on_hold', 'cancelled', 'draft'];

interface StatusSummaryCardsProps {
  counts: Record<ProjectStatus, number>;
}

// Dot + label up top, big count below, and an outlined circular status icon anchored to
// the bottom-right corner — the original layout used before the Dashboard StatCard pass.
export default function StatusSummaryCards({ counts }: StatusSummaryCardsProps) {
  return (
    <div className="flex gap-4 overflow-x-auto scrollbar-none snap-x sm:grid sm:grid-cols-3 sm:overflow-visible lg:grid-cols-5">
      {ORDER.map((status) => {
        const Icon = STATUS_ICON[status];
        const color = STATUS_DOT[status];
        return (
          <div
            key={status}
            className="bg-white p-5 rounded-2xl border border-slate-100 shadow-[0px_2px_7px_-1px_rgba(0,0,0,0.1)] flex items-end justify-between gap-3 shrink-0 w-60 snap-start sm:w-auto"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 mb-2">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <span className="text-sm text-[#6F6F6F] font-medium truncate">{STATUS_LABEL[status]}</span>
              </div>
              <h3 className="text-4xl font-bold text-[#374151]">{counts[status]}</h3>
            </div>
            <div className="w-11 h-11 flex items-center justify-center shrink-0" style={{ color }}>
              <Icon size={38} strokeWidth={2} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
