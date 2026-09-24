import { ReactNode } from 'react';

interface StatCardProps {
  icon: ReactNode;
  iconColor: string;
  label: string;
  value: ReactNode;
  detail: ReactNode;
  detailClassName?: string;
}

// Matches the Project Board's StatusSummaryCards treatment (plain, solid-colored icon — no
// tinted background square) rather than the icon-badge style used inside this page's own content
// cards, so the top stat row reads consistently with the equivalent stat-card row on other pages.
export default function StatCard({ icon, iconColor, label, value, detail, detailClassName = 'text-[#6F6F6F]' }: StatCardProps) {
  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-[0px_2px_7px_-1px_rgba(0,0,0,0.1)] flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs text-[#6F6F6F] font-medium truncate">{label}</p>
        <h3 className="text-2xl font-bold text-[#272220]">{value}</h3>
        <div className={`text-[11px] mt-0.5 ${detailClassName}`}>{detail}</div>
      </div>
      <div className="shrink-0" style={{ color: iconColor }}>
        {icon}
      </div>
    </div>
  );
}
