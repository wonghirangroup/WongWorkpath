import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarRange } from 'lucide-react';
import { Employee } from '../../types';
import { ProjectRow, ProjectTaskItem } from './types';
import { TASK_STATUS_COLOR, TASK_STATUS_LABEL } from './statusMeta';
import { displayName } from './CreateProjectModal';
import { getAvatarColor } from '../../lib/avatarColor';
import Tooltip from '../Tooltip';
import EmployeeAvatar from '../EmployeeAvatar';

// Overlapping avatar stack trailing each bar — up to 3 faces plus a "+N" pill, ring-bordered so
// they read as a group against whatever color the bar/background happens to be.
function AvatarStack({ people, sizePx = 22 }: { people: Employee[]; sizePx?: number }) {
  if (people.length === 0) return null;
  const shown = people.slice(0, 3);
  const extra = people.length - shown.length;
  return (
    <div className="flex items-center -space-x-2 shrink-0">
      {shown.map((p) =>
        p.avatar ? (
          <img
            key={p.id}
            src={p.avatar}
            alt=""
            className="rounded-full object-cover ring-2 ring-white shrink-0"
            style={{ width: sizePx, height: sizePx }}
          />
        ) : (
          <div key={p.id} className="ring-2 ring-white rounded-full shrink-0">
            <EmployeeAvatar name={displayName(p)} sizePx={sizePx} />
          </div>
        )
      )}
      {extra > 0 && (
        <span
          className="rounded-full bg-slate-200 text-slate-600 text-[9px] font-bold flex items-center justify-center ring-2 ring-white shrink-0"
          style={{ width: sizePx, height: sizePx }}
        >
          +{extra}
        </span>
      )}
    </div>
  );
}

const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const THAI_WEEKDAY_SHORT = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

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

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// The coordinate system stays real calendar days at every zoom level (never percentage-of-range)
// — only the pixel width given to one day changes, which is what actually makes "เดือน"/"ปี" feel
// zoomed out. That keeps bar-position math identical across zoom levels instead of needing a
// separate month/year unit system.
type GanttZoom = 'day' | 'month' | 'year';
const ZOOM_OPTIONS: { value: GanttZoom; label: string }[] = [
  { value: 'day', label: 'วัน' },
  { value: 'month', label: 'เดือน' },
  { value: 'year', label: 'ปี' },
];
const PX_PER_DAY: Record<GanttZoom, number> = { day: 48, month: 8, year: 2.2 };
const LABEL_COL_WIDTH = 210;
const DAY_MS = 24 * 60 * 60 * 1000;

interface ProjectGanttProps {
  tasks: ProjectTaskItem[];
  employees: Employee[];
  // Only passed by callers that mix tasks from more than one project on the same timeline (e.g.
  // MyWorkspace's "งานของฉัน" — tasks across every project the account is on). ProjectDetail's own
  // per-project Timeline tab leaves this unset since every row there is already the same project.
  projects?: ProjectRow[];
}

export default function ProjectGantt({ tasks, employees, projects }: ProjectGanttProps) {
  const [zoom, setZoom] = useState<GanttZoom>('day');
  const projectById = useMemo(() => new Map((projects ?? []).map((p) => [p.id, p])), [projects]);

  // Measures the scroll container's visible width so a short date range can stretch its day
  // columns to fill the card instead of leaving a block of empty space after the last column —
  // only ever widens columns beyond their normal PX_PER_DAY, never shrinks them (a long range
  // still scrolls horizontally as before).
  const scrollRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => setContainerWidth(entries[0].contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

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
    min = startOfDay(new Date(min.getTime() - 2 * DAY_MS));
    max = startOfDay(new Date(max.getTime() + 2 * DAY_MS));
    const totalDays = Math.max(Math.round((max.getTime() - min.getTime()) / DAY_MS), 1);
    return { min, max, totalDays };
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

  // Stretching short ranges to fill the card only makes sense at day-zoom (individual day cells
  // widening to stay readable) — doing the same at month/year zoom would inflate pxPerDay right
  // when those levels are supposed to compress time, making them render almost identically to
  // day-zoom and turning their header into one meaningless full-width label.
  const availableColumnsWidth = containerWidth > LABEL_COL_WIDTH ? containerWidth - LABEL_COL_WIDTH : 0;
  const pxPerDay = zoom === 'day' ? Math.max(PX_PER_DAY[zoom], availableColumnsWidth / range.totalDays) : PX_PER_DAY[zoom];
  const dayOffset = (d: Date) => (d.getTime() - range.min.getTime()) / DAY_MS;
  const totalWidth = range.totalDays * pxPerDay;

  // Day-zoom header: one bordered cell per real calendar day (weekday + day number), shaded for
  // Saturday/Sunday and ringed for today — this is the "จัดวันเป็นช่องๆ" grid the reference asked for.
  const dayColumns = Array.from({ length: range.totalDays }, (_, i) => {
    const date = new Date(range.min.getTime() + i * DAY_MS);
    const weekday = date.getDay();
    return { date, isWeekend: weekday === 0 || weekday === 6, isToday: isSameDay(date, new Date()) };
  });

  // Month/year zoom headers: one cell per real calendar boundary within the range, widened to
  // match however many days of that month/year actually fall inside the visible range.
  const groupedColumns = useMemo(() => {
    if (zoom === 'day') return [];
    const cols: { label: string; days: number; isToday: boolean }[] = [];
    let cursor = new Date(range.min);
    const now = new Date();
    while (cursor < range.max) {
      const next = zoom === 'month'
        ? new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
        : new Date(cursor.getFullYear() + 1, 0, 1);
      const segmentEnd = next < range.max ? next : range.max;
      const days = Math.max(Math.round((segmentEnd.getTime() - cursor.getTime()) / DAY_MS), 1);
      const label = zoom === 'month'
        ? `${THAI_MONTHS[cursor.getMonth()]} ${(cursor.getFullYear() + 543) % 100}`
        : `${cursor.getFullYear() + 543}`;
      const isToday = now >= cursor && now < segmentEnd;
      cols.push({ label, days, isToday });
      cursor = next;
    }
    return cols;
  }, [zoom, range]);

  const nowInRange = new Date() >= range.min && new Date() <= range.max;
  const nowLeftPx = nowInRange ? dayOffset(new Date()) * pxPerDay : null;
  const nowLabel = `วันนี้ ${new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}`;

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

      {/* The one scroll container for the whole chart — sliding it horizontally is how you move
          through the timeline at any zoom level, since both the header row and every task row
          below share this exact same scroll position. */}
      <div className="overflow-x-auto" ref={scrollRef}>
        <div style={{ width: LABEL_COL_WIDTH + totalWidth }}>
          {/* Header row — day zoom draws one cell per real day; month/year zoom draws one wider
              cell per calendar month/year instead, sized to how many days of it are in view. */}
          <div className="flex border-b border-[#F4F4F4] sticky top-0 z-20 bg-white">
            <div
              className="shrink-0 px-5 py-3 text-xs font-medium text-[#A0A0A0] border-r border-[#F4F4F4] sticky left-0 z-20 bg-white"
              style={{ width: LABEL_COL_WIDTH }}
            >
              งาน / ผู้รับผิดชอบ
            </div>
            {zoom === 'day' ? (
              dayColumns.map((col, idx) => (
                <div
                  key={idx}
                  className={`shrink-0 flex flex-col items-center justify-center py-1.5 border-r border-[#F4F4F4] ${
                    col.isWeekend ? 'bg-[#FBFBFB]' : ''
                  }`}
                  style={{ width: pxPerDay }}
                >
                  <span className="text-[9px] text-[#A0A0A0]">{THAI_WEEKDAY_SHORT[col.date.getDay()]}</span>
                  <span
                    className={`text-[11px] font-semibold ${
                      col.isToday ? 'w-5 h-5 rounded-full bg-[#FF6537] text-white flex items-center justify-center' : 'text-[#272220]'
                    }`}
                  >
                    {col.date.getDate()}
                  </span>
                </div>
              ))
            ) : (
              groupedColumns.map((col, idx) => (
                <div
                  key={idx}
                  className={`shrink-0 flex items-center justify-center text-[11px] font-semibold border-r border-[#F4F4F4] ${
                    col.isToday ? 'text-[#FF6537]' : 'text-[#272220]'
                  }`}
                  style={{ width: col.days * pxPerDay }}
                >
                  {col.label}
                </div>
              ))
            )}
          </div>

          <div className="divide-y divide-[#F9F9F9] relative">
            {/* Vertical day-cell gridlines behind every row, at day zoom only — month/year zoom
                keeps just the header's own boundary lines, since a line per day would be too
                dense to read once each day is only 2-8px wide. */}
            {zoom === 'day' && (
              <div className="absolute inset-y-0 pointer-events-none" style={{ left: LABEL_COL_WIDTH, width: totalWidth }}>
                {dayColumns.map((col, idx) => (
                  <div
                    key={idx}
                    className={`absolute inset-y-0 border-r border-[#F4F4F4] ${col.isWeekend ? 'bg-[#FBFBFB]' : ''}`}
                    style={{ left: idx * pxPerDay, width: pxPerDay }}
                  />
                ))}
              </div>
            )}
            {nowLeftPx !== null && (
              <div
                className="absolute top-0 bottom-0 border-l-2 border-dashed border-[#FF6537]/40 z-10 pointer-events-none"
                style={{ left: LABEL_COL_WIDTH + nowLeftPx }}
              />
            )}

            {bars.map(({ task: t, start, end }) => {
              const assignees = t.assigneeEmployeeIds.map((id) => employeeById.get(id)).filter((e): e is Employee => Boolean(e));
              const firstAssignee = assignees[0];
              const leftPx = dayOffset(start) * pxPerDay;
              const widthPx = Math.max(dayOffset(end) * pxPerDay - leftPx, pxPerDay * 0.6);
              const color = TASK_STATUS_COLOR[t.status];

              return (
                <div key={t.id} className="flex hover:bg-[#FAFAFA] relative">
                  <div
                    className="shrink-0 px-5 py-3 border-r border-[#F4F4F4] sticky left-0 z-10 bg-white"
                    style={{ width: LABEL_COL_WIDTH }}
                  >
                    <p className="text-sm font-medium text-[#272220] truncate">{t.title}</p>
                    {projects && (
                      <p className="text-[10px] text-[#A0A0A0] truncate">โครงการ: {projectById.get(t.projectId)?.title ?? 'ไม่ทราบโครงการ'}</p>
                    )}
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

                  <div className="relative min-h-14" style={{ width: totalWidth }}>
                    <Tooltip content={`${t.title} · ${TASK_STATUS_LABEL[t.status]} · ${t.progress}%`}>
                      <div
                        className="absolute top-1/2 -translate-y-1/2 h-7 rounded-full overflow-hidden shadow-sm"
                        style={{ left: leftPx, width: widthPx, backgroundColor: color }}
                      >
                        <div className="absolute inset-y-0 left-0 bg-white/25" style={{ width: `${t.progress}%` }} />
                      </div>
                    </Tooltip>
                    <div className="absolute top-1/2 -translate-y-1/2" style={{ left: leftPx + widthPx + 6 }}>
                      <AvatarStack people={assignees} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {nowInRange && (
        <p className="px-5 py-2 text-[10px] text-[#A0A0A0] border-t border-[#F4F4F4]">{nowLabel}</p>
      )}
    </div>
  );
}
