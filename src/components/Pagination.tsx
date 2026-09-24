import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPage: (page: number) => void;
}

type PageItem = number | 'gap-start' | 'gap-end';

// Page buttons for a list that can grow without bound (the activity log): the first and last page, the
// current one and its neighbours, with "…" standing in for the rest — 1 … 4 5 6 … 30 — so the bar
// never grows wider than the card no matter how many pages there are.
export function pageItems(current: number, total: number): PageItem[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  let start = Math.max(2, current - 1);
  let end = Math.min(total - 1, current + 1);
  if (current <= 3) end = Math.min(total - 1, 4);
  if (current >= total - 2) start = Math.max(2, total - 3);
  const items: PageItem[] = [1];
  if (start > 2) items.push('gap-start');
  for (let p = start; p <= end; p++) items.push(p);
  if (end < total - 1) items.push('gap-end');
  items.push(total);
  return items;
}

const arrowClass =
  'w-9 h-9 lg:w-8 lg:h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-[#FF6537] hover:bg-orange-50 disabled:text-slate-300 disabled:hover:bg-white disabled:cursor-not-allowed cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6537] focus-visible:ring-offset-1';

// Same look as the project board's page buttons; this one adds the "…" shortening above.
export default function Pagination({ currentPage, totalPages, onPage }: PaginationProps) {
  return (
    <nav aria-label="แบ่งหน้า" className="flex justify-center items-center gap-1.5 shrink-0">
      <button type="button" onClick={() => onPage(currentPage - 1)} disabled={currentPage <= 1} aria-label="หน้าก่อนหน้า" className={arrowClass}>
        <ChevronLeft size={16} />
      </button>
      {pageItems(currentPage, totalPages).map((item) =>
        typeof item === 'number' ? (
          <button
            key={item}
            type="button"
            onClick={() => onPage(item)}
            aria-label={`ไปหน้า ${item}`}
            aria-current={item === currentPage ? 'page' : undefined}
            className={`min-w-9 h-9 lg:min-w-8 lg:h-8 px-1 rounded-lg text-sm font-bold cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6537] focus-visible:ring-offset-1 ${
              item === currentPage ? 'bg-[#FF6537] text-white shadow-sm' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {item}
          </button>
        ) : (
          <span key={item} aria-hidden className="w-6 text-center text-slate-500 select-none">…</span>
        )
      )}
      <button type="button" onClick={() => onPage(currentPage + 1)} disabled={currentPage >= totalPages} aria-label="หน้าถัดไป" className={arrowClass}>
        <ChevronRight size={16} />
      </button>
    </nav>
  );
}
