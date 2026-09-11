import { useMemo } from 'react';
import { CalendarRange } from 'lucide-react';
import { Employee } from '../../types';
import { ProjectTaskItem } from './types';
import { TASK_STATUS_COLOR, TASK_STATUS_LABEL } from './statusMeta';
import { displayName } from './CreateProjectModal';
import { getAvatarColor } from '../../lib/avatarColor';

const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

// Reverses formatThaiDateShort ("24 ส.ค. 2569" -> Date) so the chart can position bars on a
// real time axis — the task data only carries pre-formatted Thai display strings, not ISO dates.
function parseThaiDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parts = value.trim().split(/\s+/);
  if (parts.length !== 3) return null;
  const day = parseInt(parts[0], 10);
  const monthIndex = THAI_MONTHS.indexOf(parts[1]);
  const buddhistYear = parseInt(parts[2], 10);
  if (Number.isNaN(day) || monthIndex === -1 || Number.isNaN(buddhistYear)) return null;
  return new Date(buddhistYear - 543, monthIndex, day);
}

function formatAxisLabel(d: Date): string {
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

interface ProjectGanttProps {
  tasks: ProjectTaskItem[];
  employees: Employee[];
}

export default function ProjectGantt({ tasks, employees }: ProjectGanttProps) {
  const employeeById = useMemo(() => {
    const map = new Map<string, Employee>();
    employees.forEach((e) => map.set(e.id, e));
    return map;
  }, [employees]);

  const bars = useMemo(() => {
    return tasks
      .map((t) => {
        const end = parseThaiDate(t.dueDate);
        if (!end) return null;
        const parsedStart = parseThaiDate(t.startDate);
        // Tasks with no recorded start date still get a visible bar — assume a 3-day span
        // ending at the due date, rather than dropping them from the chart entirely.
        const start = parsedStart && parsedStart <= end ? parsedStart : new Date(end.getTime() - 3 * DAY_MS);
        return { task: t, start, end };
      })
      .filter((b): b is { task: ProjectTaskItem; start: Date; end: Date } => Boolean(b));
  }, [tasks]);

  const range = useMemo(() => {
    if (bars.length === 0) return null;
    let min = bars[0].start;
    let max = bars[0].end;
    bars.forEach((b) => {
      if (b.start < min) min = b.start;
      if (b.end > max) max = b.end;
    });
    min = new Date(min.getTime() - 2 * DAY_MS);
    max = new Date(max.getTime() + 2 * DAY_MS);
    const totalMs = Math.max(max.getTime() - min.getTime(), DAY_MS);
    return { min, max, totalMs };
  }, [bars]);

  if (!range) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-[0px_2px_7px_-1px_rgba(0,0,0,0.1)] p-5">
        <p className="text-sm text-[#A0A0A0] flex items-center gap-2">
          <CalendarRange size={16} />
          ยังไม่มีงานที่มีกำหนดส่งสำหรับแสดง Timeline
        </p>
      </div>
    );
  }

  const axisTicks = 5;
  const ticks = Array.from({ length: axisTicks }, (_, i) => {
    const t = i / (axisTicks - 1);
    return new Date(range.min.getTime() + t * range.totalMs);
  });

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-[0px_2px_7px_-1px_rgba(0,0,0,0.1)] overflow-hidden">
      <div className="overflow-x-auto">
        <div className="min-w-175">
          <div className="flex border-b border-[#F4F4F4]">
            <div className="w-52.5 shrink-0 px-5 py-3 text-xs font-medium text-[#A0A0A0] border-r border-[#F4F4F4]">
              งาน / ผู้รับผิดชอบ
            </div>
            <div className="flex-1 relative flex">
              {ticks.map((d, idx) => (
                <div key={idx} className="flex-1 text-center py-3 text-[11px] text-[#A0A0A0] border-r border-[#F9F9F9] last:border-r-0">
                  {formatAxisLabel(d)}
                </div>
              ))}
            </div>
          </div>

          <div className="divide-y divide-[#F9F9F9]">
            {bars.map(({ task: t, start, end }) => {
              const assignee = employeeById.get(t.assigneeEmployeeId);
              const leftPct = ((start.getTime() - range.min.getTime()) / range.totalMs) * 100;
              const widthPct = Math.max(((end.getTime() - start.getTime()) / range.totalMs) * 100, 3);
              const color = TASK_STATUS_COLOR[t.status];

              return (
                <div key={t.id} className="flex hover:bg-[#FAFAFA]">
                  <div className="w-52.5 shrink-0 px-5 py-3 border-r border-[#F4F4F4]">
                    <p className="text-sm font-medium text-[#272220] truncate">{t.title}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      {assignee ? (
                        <>
                          {assignee.avatar ? (
                            <img src={assignee.avatar} alt="" className="w-4.5 h-4.5 rounded-full object-cover shrink-0" />
                          ) : (
                            <span
                              className="w-4.5 h-4.5 rounded-full flex items-center justify-center text-white text-[8px] font-bold shrink-0"
                              style={{ backgroundColor: getAvatarColor(displayName(assignee)) }}
                            >
                              {displayName(assignee).trim().charAt(0).toUpperCase()}
                            </span>
                          )}
                          <span className="text-[11px] text-[#6F6F6F] truncate">{displayName(assignee)}</span>
                        </>
                      ) : (
                        <span className="text-[11px] text-[#A0A0A0]">ยังไม่มีผู้รับผิดชอบ</span>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 relative min-h-14">
                    <div
                      className="absolute top-1/2 -translate-y-1/2 h-6 rounded-md flex items-center px-2 overflow-hidden"
                      style={{ left: `${leftPct}%`, width: `${widthPct}%`, backgroundColor: color }}
                      title={`${t.title} · ${TASK_STATUS_LABEL[t.status]} · ${t.progress}%`}
                    >
                      <div className="absolute inset-y-0 left-0 bg-white/25" style={{ width: `${t.progress}%` }} />
                      <span className="relative text-[10px] font-semibold text-white truncate">{t.progress}%</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
