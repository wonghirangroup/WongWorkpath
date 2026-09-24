import { Employee } from '../../types';
import { ProjectRow } from '../projectBoard/types';
import { STATUS_LABEL, STATUS_PILL, STATUS_ICON, STATUS_DOT } from '../projectBoard/statusMeta';
import Tooltip from '../Tooltip';
import PeopleCell from '../projectBoard/PeopleCell';

function formatBaht(n: number): string {
  return `฿${Math.round(n).toLocaleString('th-TH')}`;
}

// Same single-ring technique as ProjectCard's ProgressRing, sized down to fit a table cell.
function MiniProgressRing({ progress, color }: { progress: number; color: string }) {
  const size = 40;
  const stroke = 5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, progress));
  const offset = circumference * (1 - clamped / 100);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="#F0F0F0" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[11px] font-bold text-[#272220]">{clamped}%</span>
      </div>
    </div>
  );
}

interface ProjectSummaryTableProps {
  projects: ProjectRow[];
  employees: Employee[];
  onSelectProject: (id: string) => void;
  titleOverride?: string;
}

export default function ProjectSummaryTable({ projects, employees, onSelectProject, titleOverride }: ProjectSummaryTableProps) {
  const employeeById = new Map(employees.map((e) => [e.id, e]));

  // No status/responsible-person filters here — the dashboard's own toolbar (department/project)
  // already scopes this list once; a second, independent filter layer on top just added clicks
  // without a clear reason to filter this widget differently from every other one on the page.
  const filtered = [...projects].sort((a, b) => (a.daysUntilDue ?? Infinity) - (b.daysUntilDue ?? Infinity));

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-[0px_2px_7px_-1px_rgba(0,0,0,0.1)] h-full flex flex-col">
      <div className="mb-4">
        <h3 className="text-base font-bold text-[#272220]">{titleOverride ?? 'สรุปโครงการ (Project Summary)'}</h3>
        <p className="text-xs text-[#6F6F6F]">ภาพรวมโครงการ ผู้รับผิดชอบ และความคืบหน้าล่าสุด</p>
      </div>

      {filtered.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-xs text-[#6F6F6F] py-6">ไม่พบโครงการที่ตรงกับตัวกรอง</div>
      ) : (
        <div className="flex-1 overflow-auto max-h-90">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] text-[#6F6F6F] border-b border-slate-100">
                <th className="pb-2 font-semibold">ชื่อโครงการ</th>
                <th className="pb-2 font-semibold">ผู้รับผิดชอบหลัก</th>
                <th className="pb-2 font-semibold">วันครบกำหนด</th>
                <th className="pb-2 font-semibold">งบประมาณ</th>
                <th className="pb-2 font-semibold">สถานะ</th>
                <th className="pb-2 font-semibold text-right">ความคืบหน้า</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const owners = p.ownerEmployeeIds.map((id) => employeeById.get(id)).filter((e): e is Employee => Boolean(e));
                const StatusIcon = STATUS_ICON[p.status];
                const overdue = p.daysUntilDue !== undefined && p.daysUntilDue < 0;
                return (
                  <tr
                    key={p.id}
                    onClick={() => onSelectProject(p.id)}
                    className="border-b border-slate-50 last:border-0 hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="py-2.5 pr-3 max-w-40">
                      <Tooltip content={p.title}>
                        <p className="font-medium text-[#272220] truncate">{p.title}</p>
                      </Tooltip>
                    </td>
                    <td className="py-2.5 pr-3">
                      <PeopleCell people={owners} size={24} />
                    </td>
                    <td className="py-2.5 pr-3 whitespace-nowrap">
                      <p className="text-xs text-[#272220]">{p.endDate ?? 'ไม่ระบุ'}</p>
                      {p.daysUntilDue !== undefined && (
                        <p className={`text-[11px] ${overdue ? 'text-[#FF2A04] font-semibold' : 'text-[#6F6F6F]'}`}>
                          {overdue ? 'เลยกำหนดแล้ว' : `อีก ${p.daysUntilDue} วัน`}
                        </p>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 whitespace-nowrap text-xs text-[#272220]">
                      {p.budget !== null ? formatBaht(p.budget) : <span className="text-[#6F6F6F]">ยังไม่มี</span>}
                    </td>
                    <td className="py-2.5 pr-3 whitespace-nowrap">
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium"
                        style={{ backgroundColor: STATUS_PILL[p.status].bg, color: STATUS_PILL[p.status].text }}
                      >
                        <StatusIcon size={11} />
                        {STATUS_LABEL[p.status]}
                      </span>
                    </td>
                    <td className="py-2.5">
                      <div className="flex justify-end">
                        <MiniProgressRing progress={p.progress ?? 0} color={STATUS_DOT[p.status]} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
