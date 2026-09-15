import { STATUS_LABEL, STATUS_DOT, STATUS_ICON } from './statusMeta';

interface StatusSummaryCardsProps {
  counts: Record<string, number>;
  selectedIds: string[];
}

// Dot + label up top, big count below, and an outlined circular status icon anchored to
// the bottom-right corner. Which up-to-5 statuses show is chosen from ProjectBoard's toolbar
// (StatusWidgetSettingsMenu), which owns that selection and its persistence.
export default function StatusSummaryCards({ counts, selectedIds }: StatusSummaryCardsProps) {
  return (
    <div className="flex gap-4 overflow-x-auto scrollbar-none snap-x sm:grid sm:grid-cols-3 sm:overflow-visible lg:grid-cols-5">
      {selectedIds.map((status) => {
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
              <h3 className="text-4xl font-bold text-[#374151]">{counts[status] ?? 0}</h3>
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
