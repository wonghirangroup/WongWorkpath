import { useMemo, useState } from 'react';
import { CalendarRange, ChevronLeft, ChevronRight } from 'lucide-react';
import { ProjectRow, ProjectTaskItem } from './types';
import { STATUS_DOT, STATUS_LABEL, TASK_STATUS_COLOR } from './statusMeta';
import Tooltip from '../Tooltip';

// A month-column overview instead of a fine day-axis — day-level ticks (per the older version of
// this chart) don't scale once projects span multiple months each, since 6 date ticks across a
// multi-month range says almost nothing about any individual month. One column per calendar month,
// a full year at a time (prev/next year nav), each project drawn as a solid status-colored bar
// across the months its own start/end range touches (a faint row tint alone was invisible for
// grey statuses like ร่าง), and up to 2 of that project's own tasks (by due date) surfaced directly
// under it in whichever month they're due — "which tasks, due when" at a glance per project.
const THAI_MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

interface ProjectsGanttChartProps {
  projects: ProjectRow[];
  projectTasks: ProjectTaskItem[];
  onSelectProject: (id: string) => void;
}

export default function ProjectsGanttChart({ projects, projectTasks, onSelectProject }: ProjectsGanttChartProps) {
  const [year, setYear] = useState(() => new Date().getFullYear());

  // Every project is its own row here regardless of whether it has any dates at all — a project
  // with no end date and no due-dated tasks yet simply gets no bar (see hasBar below), same as
  // any month it doesn't otherwise touch, rather than being hidden from the list entirely until
  // someone gets around to scheduling it.
  const rows = useMemo(() => {
    return projects.map((p) => {
      const tasksForProject = projectTasks.filter((t) => t.projectId === p.id && t.dueDateISO);

      let start: Date | null = null;
      let end: Date | null = null;
      if (p.endDateISO) {
        end = new Date(`${p.endDateISO}T00:00:00`);
        const parsedStart = p.startDateISO ? new Date(`${p.startDateISO}T00:00:00`) : null;
        start = parsedStart && parsedStart <= end ? parsedStart : end;
      } else if (tasksForProject.length > 0) {
        // No end date set on the project itself yet, but real work already exists under it —
        // derive the visible range from its own tasks' due dates instead of hiding the whole
        // project from the timeline until someone gets around to filling in its dates.
        const dueTimes = tasksForProject.map((t) => new Date(`${t.dueDateISO}T00:00:00`).getTime());
        start = new Date(Math.min(...dueTimes));
        end = new Date(Math.max(...dueTimes));
      }
      const isDerivedFromTasks = !p.endDateISO && start !== null;

      const startMonthKey = start ? start.getFullYear() * 12 + start.getMonth() : null;
      const endMonthKey = end ? end.getFullYear() * 12 + end.getMonth() : null;

      const tasksByMonth = new Map<number, ProjectTaskItem[]>();
      tasksForProject.forEach((t) => {
        const due = new Date(`${t.dueDateISO}T00:00:00`);
        const key = due.getFullYear() * 12 + due.getMonth();
        const list = tasksByMonth.get(key) ?? [];
        list.push(t);
        tasksByMonth.set(key, list);
      });

      return { project: p, startMonthKey, endMonthKey, tasksByMonth, isDerivedFromTasks, start, end };
    });
  }, [projects, projectTasks]);

  const formatShort = (d: Date) => `${d.getDate()} ${THAI_MONTHS_SHORT[d.getMonth()]} ${d.getFullYear() + 543}`;

  if (rows.length === 0) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center gap-2 text-sm text-[#A0A0A0]">
        <CalendarRange size={16} />
        ยังไม่มีโครงการในระบบ
      </div>
    );
  }

  const months = Array.from({ length: 12 }, (_, i) => year * 12 + i);

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="shrink-0 flex items-center justify-center gap-3 py-2 border-b border-[#F4F4F4]">
        <button
          type="button"
          onClick={() => setYear((y) => y - 1)}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-[#6F6F6F] hover:bg-slate-100 cursor-pointer"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-bold text-[#272220]">ปี {year + 543}</span>
        <button
          type="button"
          onClick={() => setYear((y) => y + 1)}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-[#6F6F6F] hover:bg-slate-100 cursor-pointer"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        <div className="min-w-225">
          <div className="flex border-b border-[#F4F4F4] sticky top-0 bg-white z-10">
            <div className="w-45 shrink-0 px-4 py-2.5 text-xs font-medium text-[#A0A0A0] border-r border-[#F4F4F4]">
              โครงการ
            </div>
            <div className="flex-1 grid grid-cols-12">
              {THAI_MONTHS_SHORT.map((label, idx) => (
                <div key={idx} className="text-center py-2.5 text-[11px] text-[#A0A0A0] border-r border-[#F9F9F9] last:border-r-0">
                  {label}
                </div>
              ))}
            </div>
          </div>

          <div className="divide-y divide-[#F9F9F9]">
            {rows.map(({ project: p, startMonthKey, endMonthKey, tasksByMonth, isDerivedFromTasks, start, end }) => {
              const color = STATUS_DOT[p.status];
              const yearStartKey = year * 12;
              const hasDates = startMonthKey !== null && endMonthKey !== null;
              const visibleStart = hasDates ? Math.max(startMonthKey, yearStartKey) : 0;
              const visibleEnd = hasDates ? Math.min(endMonthKey, yearStartKey + 11) : -1;
              const hasBar = hasDates && visibleStart <= visibleEnd;
              const continuesBefore = hasDates && startMonthKey < yearStartKey;
              const continuesAfter = hasDates && endMonthKey > yearStartKey + 11;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onSelectProject(p.id)}
                  className="w-full flex hover:bg-[#FAFAFA] cursor-pointer text-left"
                >
                  <div className="w-45 shrink-0 px-4 py-2.5 border-r border-[#F4F4F4] min-w-0">
                    <p className="text-sm font-medium text-[#272220] truncate">{p.title}</p>
                    <p className="text-[11px] text-[#A0A0A0] truncate">{p.code} · {STATUS_LABEL[p.status]}</p>
                  </div>
                  <div className="flex-1 relative min-h-16">
                    <div className="absolute inset-0 grid grid-cols-12 pointer-events-none">
                      {months.map((monthKey) => (
                        <div key={monthKey} className="border-r border-[#F9F9F9] last:border-r-0" />
                      ))}
                    </div>
                    <div className="relative grid grid-cols-12 gap-y-1 py-2">
                      {hasBar && (
                        <Tooltip
                          content={
                            isDerivedFromTasks
                              ? `${p.title} · ยังไม่กำหนดวันที่โครงการ — ช่วงนี้มาจากกำหนดส่งงาน (${formatShort(start)} – ${formatShort(end)})`
                              : `${p.title} · ${p.startDate ?? '—'} – ${p.endDate ?? '—'}`
                          }
                        >
                          <div
                            className={`h-3 self-center ${continuesBefore ? 'rounded-l-none' : 'ml-1 rounded-l-full'} ${
                              continuesAfter ? 'rounded-r-none' : 'mr-1 rounded-r-full'
                            }`}
                            style={
                              isDerivedFromTasks
                                // Dashed outline instead of a solid fill — signals "this range came
                                // from task due dates, not a date the project itself has set" at a
                                // glance, same distinction the tooltip spells out.
                                ? {
                                    gridRow: 1,
                                    gridColumn: `${visibleStart - yearStartKey + 1} / ${visibleEnd - yearStartKey + 2}`,
                                    backgroundColor: `${color}1A`,
                                    border: `1.5px dashed ${color}`,
                                  }
                                : {
                                    gridRow: 1,
                                    gridColumn: `${visibleStart - yearStartKey + 1} / ${visibleEnd - yearStartKey + 2}`,
                                    backgroundColor: color,
                                  }
                            }
                          />
                        </Tooltip>
                      )}
                      {!hasDates && (
                        <div className="flex items-center h-3 self-center" style={{ gridRow: 1, gridColumn: '1 / 4' }}>
                          <span className="text-[10px] text-[#A0A0A0] italic ml-1">ยังไม่กำหนดวันที่</span>
                        </div>
                      )}
                      {months.map((monthKey, idx) => {
                        const monthTasks = tasksByMonth.get(monthKey) ?? [];
                        if (monthTasks.length === 0) return null;
                        return (
                          <div key={monthKey} className="px-1 flex flex-col gap-0.5 min-w-0" style={{ gridRow: 2, gridColumn: idx + 1 }}>
                            {monthTasks.slice(0, 2).map((t) => (
                              <Tooltip key={t.id} content={`${t.title} · กำหนดส่ง ${t.dueDate}`}>
                                <div
                                  className="text-[9px] px-1 py-0.5 rounded truncate font-medium"
                                  style={{ backgroundColor: `${TASK_STATUS_COLOR[t.status]}1A`, color: TASK_STATUS_COLOR[t.status] }}
                                >
                                  {new Date(`${t.dueDateISO}T00:00:00`).getDate()} — {t.title}
                                </div>
                              </Tooltip>
                            ))}
                            {monthTasks.length > 2 && (
                              <div className="text-[8px] text-center text-[#A0A0A0] font-bold">+{monthTasks.length - 2} งาน</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
