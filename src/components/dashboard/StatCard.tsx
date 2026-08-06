import { ReactNode } from 'react';

interface StatCardProps {
  icon: ReactNode;
  iconBgClass: string;
  label: string;
  value: ReactNode;
  detail: ReactNode;
  detailClassName?: string;
}

export default function StatCard({ icon, iconBgClass, label, value, detail, detailClassName = 'text-slate-400' }: StatCardProps) {
  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4">
      <div className={`p-3.5 rounded-xl ${iconBgClass}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-slate-500 font-medium">{label}</p>
        <h3 className="text-2xl font-bold text-slate-900">{value}</h3>
        <div className={`text-[11px] mt-0.5 ${detailClassName}`}>{detail}</div>
      </div>
    </div>
  );
}
