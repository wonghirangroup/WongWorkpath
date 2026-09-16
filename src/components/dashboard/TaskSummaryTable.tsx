import { Employee } from '../../types';
import { ProjectTaskItem } from '../projectBoard/types';
import { TASK_STATUS_LABEL, TASK_STATUS_COLOR } from '../projectBoard/statusMeta';
import { displayName } from '../projectBoard/CreateProjectModal';
import { getAvatarColor } from '../../lib/avatarColor';
import Tooltip from '../Tooltip';

// Same single-ring technique as ProjectSummaryTable's own MiniProgressRing, kept local here since
// the two tables are never shown at the same time (this one replaces that one once the dashboard
// is filtered down to a single project — see Dashboard.tsx's isSingleProjectView).
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
        <span className="text-[9px] font-bold text-[#272220]">{clamped}%</span>
      </div>
    </div>
  );
}

interface TaskSummaryTableProps {
  tasks: ProjectTaskItem[];
  employees: Employee[];
  projectTitle: string;
  onSelectTask?: (task: ProjectTaskItem) => void;
}

// The dashboard's project-scoped view of "สรุปโครงการ" — once a single project is picked in the
// toolbar filter, a table of that project's own tasks is far more useful here than a one-row
// table of projects (which is all `ProjectSummaryTable` would otherwise show for a single-project
// filter). No status/responsible-person filters here by design — the project filter above already
// narrowed the scope once; a second layer of filtering on top of that just added clicks.
export default function TaskSummaryTable({ tasks, employees, projectTitle, onSelectTask }: TaskSummaryTableProps) {
  const employeeById = new Map(employees.map((e) => [e.id, e]));
  const sorted = [...tasks].sort((a, b) => (a.daysUntilDue ?? Infinity) - (b.daysUntilDue ?? Infinity));

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-[0px_2px_7px_-1px_rgba(0,0,0,0.1)] h-full flex flex-col">
      <div className="mb-4">
        <h3 className="text-base font-bold text-[#272220]">สรุปงาน (Task Summary)</h3>
        <p className="text-xs text-[#6F6F6F]">งานทั้งหมดของโครงการ "{projectTitle}"</p>
      </div>

      {sorted.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-xs text-[#A0A0A0] py-6">ยังไม่มีงานในโครงการนี้</div>
      ) : (
        <div className="flex-1 overflow-auto max-h-90">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] text-[#A0A0A0] border-b border-slate-100">
                <th className="pb-2 font-semibold">ชื่องาน</th>
                <th className="pb-2 font-semibold">ผู้รับผิดชอบ</th>
                <th className="pb-2 font-semibold">กำหนดส่ง</th>
                <th className="pb-2 font-semibold">สถานะ</th>
                <th className="pb-2 font-semibold text-right">ความคืบหน้า</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((t) => {
                const assignees = t.assigneeEmployeeIds.map((id) => employeeById.get(id)).filter((e): e is Employee => Boolean(e));
                const firstAssignee = assignees[0];
                const overdue = t.daysUntilDue !== undefined && t.daysUntilDue < 0;
                const color = TASK_STATUS_COLOR[t.status];
                return (
                  <tr
                    key={t.id}
                    onClick={() => onSelectTask?.(t)}
                    className={`border-b border-slate-50 last:border-0 transition-colors ${onSelectTask ? 'hover:bg-slate-50 cursor-pointer' : ''}`}
                  >
                    <td className="py-2.5 pr-3 max-w-40">
                      <Tooltip content={t.title}>
                        <p className="font-medium text-[#272220] truncate">{t.title}</p>
                      </Tooltip>
                    </td>
                    <td className="py-2.5 pr-3">
                      {firstAssignee ? (
                        <span className="flex items-center gap-1.5 min-w-0">
                          {firstAssignee.avatar ? (
                            <img src={firstAssignee.avatar} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
                          ) : (
                            <span
                              className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                              style={{ backgroundColor: getAvatarColor(displayName(firstAssignee)) }}
                            >
                              {displayName(firstAssignee).trim().charAt(0).toUpperCase()}
                            </span>
                          )}
                          <span className="truncate text-xs text-[#272220]">
                            {displayName(firstAssignee)}{assignees.length > 1 ? ` +${assignees.length - 1}` : ''}
                          </span>
                        </span>
                      ) : (
                        <span className="text-xs text-[#A0A0A0]">ไม่ระบุ</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 whitespace-nowrap">
                      <p className="text-xs text-[#272220]">{t.dueDate ?? 'ไม่ระบุ'}</p>
                      {t.daysUntilDue !== undefined && (
                        <p className={`text-[10px] ${overdue ? 'text-[#FF2A04] font-semibold' : 'text-[#A0A0A0]'}`}>
                          {overdue ? 'เลยกำหนดแล้ว' : `อีก ${t.daysUntilDue} วัน`}
                        </p>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 whitespace-nowrap">
                      <span
                        className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium"
                        style={{ backgroundColor: `${color}1A`, color }}
                      >
                        {TASK_STATUS_LABEL[t.status]}
                      </span>
                    </td>
                    <td className="py-2.5">
                      <div className="flex justify-end">
                        <MiniProgressRing progress={t.progress} color={color} />
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
