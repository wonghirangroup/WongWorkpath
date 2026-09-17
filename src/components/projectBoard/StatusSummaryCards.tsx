import { STATUS_LABEL, STATUS_DOT, STATUS_ICON } from './statusMeta';

interface StatusSummaryCardsProps {
  counts: Record<string, number>;
  selectedIds: string[];
}

// Dot + label up top, count below, and a plain status icon on the right — same card shell, icon
// size (32) and vertical centering as Dashboard's own StatCard, so the two stat-card rows read as
// one consistent family instead of the count/icon looking oversized here by comparison.
export default function StatusSummaryCards({ counts, selectedIds }: StatusSummaryCardsProps) {
  return (
    <div className="flex gap-4 overflow-x-auto scrollbar-none snap-x sm:grid sm:grid-cols-3 sm:overflow-visible lg:grid-cols-5">
      {selectedIds.map((status) => {
        const Icon = STATUS_ICON[status];
        const color = STATUS_DOT[status];
        return (
          <div
            key={status}
            className="bg-white p-5 rounded-2xl border border-slate-100 shadow-[0px_2px_7px_-1px_rgba(0,0,0,0.1)] flex items-center justify-between gap-3 shrink-0 w-60 snap-start sm:w-auto"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 mb-2">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <span className="text-sm text-[#6F6F6F] font-medium truncate">{STATUS_LABEL[status]}</span>
              </div>
              <h3 className="text-2xl font-bold text-[#272220]">{counts[status] ?? 0}</h3>
            </div>
            <div className="shrink-0" style={{ color }}>
              <Icon size={32} strokeWidth={2} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
