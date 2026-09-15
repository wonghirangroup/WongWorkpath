import { useMemo, useState } from 'react';
import { CalendarRange } from 'lucide-react';
import { Employee } from '../../types';
import { ProjectTaskItem } from './types';
import { TASK_STATUS_COLOR, TASK_STATUS_LABEL } from './statusMeta';
import { displayName } from './CreateProjectModal';
import { getAvatarColor } from '../../lib/avatarColor';
import Tooltip from '../Tooltip';

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

// "วัน" shows 5 evenly time-spaced points across the actual task date range; "เดือน"/"ปี" instead
// tick at real calendar-month/year boundaries within that same range — only the tick granularity
// changes with zoom, never the bars' own coordinate system (still true percentage-of-range).
type GanttZoom = 'day' | 'month' | 'year';
const ZOOM_OPTIONS: { value: GanttZoom; label: string }[] = [
  { value: 'day', label: 'วัน' },
  { value: 'month', label: 'เดือน' },
  { value: 'year', label: 'ปี' },
];

function formatAxisLabel(d: Date, zoom: GanttZoom): string {
  if (zoom === 'year') return `${d.getFullYear() + 543}`;
  if (zoom === 'month') return `${THAI_MONTHS[d.getMonth()]} ${(d.getFullYear() + 543) % 100}`;
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

interface ProjectGanttProps {
  tasks: ProjectTaskItem[];
  employees: Employee[];
}

export default function ProjectGantt({ tasks, employees }: ProjectGanttProps) {
  const [zoom, setZoom] = useState<GanttZoom>('day');

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

  // "วัน": 5 evenly time-spaced points across the range. "เดือน"/"ปี": one tick per real calendar
  // boundary within the range instead — a natural month/year grid reads better than 5 arbitrary
  // fractional points once the range spans that long. Positions still use the same
  // percentage-of-range math as the "วัน" ticks and the bars, just clamped to [0,100] since a
  // month/year boundary can fall right at (or just outside) the range's own edges.
  let ticks: Date[];
  if (zoom === 'day') {
    const axisTicks = 5;
    ticks = Array.from({ length: axisTicks }, (_, i) => new Date(range.min.getTime() + (i / (axisTicks - 1)) * range.totalMs));
  } else {
    ticks = [];
    const cursor = zoom === 'month'
      ? new Date(range.min.getFullYear(), range.min.getMonth(), 1)
      : new Date(range.min.getFullYear(), 0, 1);
    while (cursor <= range.max) {
      ticks.push(new Date(cursor));
      if (zoom === 'month') cursor.setMonth(cursor.getMonth() + 1);
      else cursor.setFullYear(cursor.getFullYear() + 1);
    }
    if (ticks.length === 0) ticks = [range.min];
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-[0px_2px_7px_-1px_rgba(0,0,0,0.1)] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#F4F4F4]">
        <h4 className="font-bold text-[#272220] text-sm">Timeline</h4>
        <div className="flex items-center gap-0.5 bg-[#F6F6F6] border border-slate-200 rounded-lg p-0.5">
          {ZOOM_OPTIONS.map((z) => (
            <button
              key={z.value}
              type="button"
              onClick={() => setZoom(z.value)}
              className={`px-2.5 h-7 rounded-md text-[11px] font-semibold cursor-pointer transition-colors ${
                zoom === z.value ? 'bg-[#FF6537] text-white' : 'text-[#6F6F6F] hover:text-[#272220]'
              }`}
            >
              {z.label}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-175">
          <div className="flex border-b border-[#F4F4F4]">
            <div className="w-52.5 shrink-0 px-5 py-3 text-xs font-medium text-[#A0A0A0] border-r border-[#F4F4F4]">
              งาน / ผู้รับผิดชอบ
            </div>
            {/* Each label sits at its own true leftPct — same coordinate system the bars below use
                (percentage-of-date-range) — instead of being centered inside an equal-width flex
                column, which put every label at (idx+0.5)/ticks worth of space regardless of the
                date it actually represented, visibly misaligning them from the bars underneath. */}
            <div className="flex-1 relative py-3">
              {ticks.map((d, idx) => {
                const rawPct = ((d.getTime() - range.min.getTime()) / range.totalMs) * 100;
                const pct = Math.max(0, Math.min(100, rawPct));
                const xShift = pct <= 0 ? '0%' : pct >= 100 ? '-100%' : '-50%';
                return (
                  <span
                    key={idx}
                    className="absolute top-1/2 text-[11px] text-[#A0A0A0] whitespace-nowrap"
                    style={{ left: `${pct}%`, transform: `translate(${xShift}, -50%)` }}
                  >
                    {formatAxisLabel(d, zoom)}
                  </span>
                );
              })}
            </div>
          </div>

          <div className="divide-y divide-[#F9F9F9]">
            {bars.map(({ task: t, start, end }) => {
              const assignees = t.assigneeEmployeeIds.map((id) => employeeById.get(id)).filter((e): e is Employee => Boolean(e));
              const firstAssignee = assignees[0];
              const leftPct = ((start.getTime() - range.min.getTime()) / range.totalMs) * 100;
              const widthPct = Math.max(((end.getTime() - start.getTime()) / range.totalMs) * 100, 3);
              const color = TASK_STATUS_COLOR[t.status];

              return (
                <div key={t.id} className="flex hover:bg-[#FAFAFA]">
                  <div className="w-52.5 shrink-0 px-5 py-3 border-r border-[#F4F4F4]">
                    <p className="text-sm font-medium text-[#272220] truncate">{t.title}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      {firstAssignee ? (
                        <>
                          {firstAssignee.avatar ? (
                            <img src={firstAssignee.avatar} alt="" className="w-4.5 h-4.5 rounded-full object-cover shrink-0" />
                          ) : (
                            <span
                              className="w-4.5 h-4.5 rounded-full flex items-center justify-center text-white text-[8px] font-bold shrink-0"
                              style={{ backgroundColor: getAvatarColor(displayName(firstAssignee)) }}
                            >
                              {displayName(firstAssignee).trim().charAt(0).toUpperCase()}
                            </span>
                          )}
                          <span className="text-[11px] text-[#6F6F6F] truncate">
                            {displayName(firstAssignee)}{assignees.length > 1 ? ` +${assignees.length - 1}` : ''}
                          </span>
                        </>
                      ) : (
                        <span className="text-[11px] text-[#A0A0A0]">ยังไม่มีผู้รับผิดชอบ</span>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 relative min-h-14">
                    <Tooltip content={`${t.title} · ${TASK_STATUS_LABEL[t.status]} · ${t.progress}%`}>
                      <div
                        className="absolute top-1/2 -translate-y-1/2 h-6 rounded-md flex items-center px-2 overflow-hidden"
                        style={{ left: `${leftPct}%`, width: `${widthPct}%`, backgroundColor: color }}
                      >
                        <div className="absolute inset-y-0 left-0 bg-white/25" style={{ width: `${t.progress}%` }} />
                        <span className="relative text-[10px] font-semibold text-white truncate">{t.progress}%</span>
                      </div>
                    </Tooltip>
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
