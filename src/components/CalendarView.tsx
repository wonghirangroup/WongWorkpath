import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Meeting, Employee } from '../types';
import { useAppData } from '../context/AppDataContext';
import {
  Calendar as CalIcon,
  ChevronLeft,
  ChevronRight,
  ListChecks,
  Users2,
  Briefcase,
  Ban,
  X
} from 'lucide-react';
import Dropdown from './Dropdown';
import ProjectsGanttChart from './projectBoard/ProjectsGanttChart';
import ScheduleMeetingModal from './projectBoard/ScheduleMeetingModal';
import CancelMeetingModal from './projectBoard/CancelMeetingModal';
import MeetingDetailModal from './projectBoard/MeetingDetailModal';
import { ProjectRow } from './projectBoard/types';
import { STATUS_DOT, STATUS_LABEL, STATUS_ICON, TASK_STATUS_COLOR, TASK_STATUS_LABEL } from './projectBoard/statusMeta';
import { formatThaiDateShort, displayName } from './projectBoard/CreateProjectModal';
import { isResponsibleForProject } from '../lib/ownership';
import Tooltip from './Tooltip';

type FilterType = 'All' | 'Tasks' | 'Meetings' | 'Projects';

const FILTER_OPTIONS: { value: FilterType; label: string; icon: typeof CalIcon }[] = [
  { value: 'All', label: 'แสดงทุกอย่าง', icon: CalIcon },
  { value: 'Tasks', label: 'เฉพาะกำหนดการส่งงาน', icon: ListChecks },
  { value: 'Meetings', label: 'เฉพาะวันนัดประชุม', icon: Users2 },
  { value: 'Projects', label: 'เฉพาะโครงการ', icon: Briefcase },
];

// The shape a real project_task row gets mapped into for the grid/popover/upcoming-list — a user
// browsing the calendar just wants to see "what's due".
interface CalendarTaskItem {
  id: string;
  title: string;
  dueDateISO: string;
  startDateISO: string | null;
  // Real project tasks carry colorHex (from the canonical TASK_STATUS_COLOR in statusMeta.ts, the
  // same palette ProjectDetail/ProjectGantt/MyWorkspace already color this exact status with) and
  // render via inline style, same technique as this file's own project-deadline chips below.
  colorClasses: string;
  colorHex?: string;
  projectLabel: string;
  projectId?: string;
  assigneeNames?: string; // display name(s) of whoever's responsible — undefined when nobody's assigned yet
}

type UpcomingItem =
  | { kind: 'task'; sortKey: string; task: CalendarTaskItem }
  | { kind: 'meeting'; sortKey: string; meeting: Meeting }
  | { kind: 'project'; sortKey: string; project: ProjectRow };

// A day cell's chips (up to 2 visible, see dayChipItems below) — same 3 kinds as UpcomingItem,
// just without a sortKey since a day cell keeps the original tasks/meetings/deadlines grouping
// order instead of sorting across kinds.
type DayChipItem =
  | { kind: 'task'; key: string; task: CalendarTaskItem }
  | { kind: 'meeting'; key: string; meeting: Meeting }
  | { kind: 'project'; key: string; project: ProjectRow };

// Stored dates are plain "YYYY-MM-DD" strings with no timezone of their own — formatting via the
// Date object's LOCAL getters (not toISOString, which converts to UTC first) is what keeps a task
// due "today" landing on today's cell instead of tomorrow's in any timezone ahead of UTC.
function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// "YYYY-MM-DDTHH:mm" strings sort lexicographically the same as chronologically, so this is a
// plain string comparison against "now" in the same shape — no Date parsing/timezone conversion
// needed since meeting.date/startTime are already local wall-clock values with no zone of their
// own (see toLocalDateString's own note on the same thing for tasks).
function isPastMeeting(meeting: Meeting): boolean {
  if (meeting.status === 'cancelled') return false; // cancelled already gets its own treatment
  const now = new Date();
  const nowString = `${toLocalDateString(now)}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return `${meeting.date}T${meeting.endTime || meeting.startTime}` < nowString;
}

export default function CalendarView() {
  const { orgSections, meetings, projects, projectTasks, employees, currentUser, handleAddMeeting, handleUpdateMeeting, setTaskSelectedProjectId, setTaskSelectedTab } = useAppData();
  const navigate = useNavigate();
  const [isScheduleMeetingOpen, setIsScheduleMeetingOpen] = useState(false);
  // ยกเลิกประชุม / detail view for a meeting with no project to navigate into — see the render
  // below for how a meeting click branches between the two.
  const [cancellingMeeting, setCancellingMeeting] = useState<Meeting | null>(null);
  const [viewingMeeting, setViewingMeeting] = useState<Meeting | null>(null);
  // A standalone (no-project) meeting being edited from its detail view — reuses the same
  // ScheduleMeetingModal instance below rather than a second one, same as ProjectDetail.tsx does
  // for its own project-scoped meetings.
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  // Opens on the real current month/year — this used to be hardcoded to July 2026 (leftover from
  // whenever the mock data was authored), so the page never showed "today" highlighted at all
  // unless you clicked "วันนี้" yourself first.
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());

  const [filterType, setFilterType] = useState<FilterType>('All');
  const [selectedDept, setSelectedDept] = useState<string>('All');
  // Every role defaults to "เฉพาะของฉัน" (meetings I created/attend, tasks assigned to me, projects
  // I'm responsible for) with a toggle to see the full company overview — no accountType branching
  // here at all, same capability for every role.
  const [scope, setScope] = useState<'mine' | 'all'>('mine');
  const currentUserId = currentUser?.id ?? '';
  const isMineOnly = (ids: string[]) => scope === 'all' || ids.includes(currentUserId);

  // Which day cell's "show everything on this day" popover is open — only one at a time.
  const [openDayKey, setOpenDayKey] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openDayKey) return;
    // Closing only happens for clicks outside the whole grid — clicks on a day cell are handled
    // by that cell's own onClick (open/close/switch), so this and that never fight over the state.
    const handler = (e: MouseEvent) => {
      if (gridRef.current && !gridRef.current.contains(e.target as Node)) setOpenDayKey(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openDayKey]);

  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const employeeById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);
  const namesFor = (ids: string[]) => {
    const names = ids.map((id) => employeeById.get(id)).filter((e): e is Employee => Boolean(e)).map(displayName);
    return names.length ? names.join(', ') : undefined;
  };
  const goToProject = (projectId: string) => {
    setTaskSelectedProjectId(projectId);
    navigate('/tasks');
  };
  // Same navigation, but also deep-links straight into the relevant tab (e.g. a meeting opens
  // directly on "การประชุม" instead of always landing on ภาพรวม first) — see ProjectDetail's own
  // initialTab prop / AppDataContext's taskSelectedTab for the other half of this.
  const goToProjectTab = (projectId: string, tab: string) => {
    setTaskSelectedTab(tab);
    goToProject(projectId);
  };
  // A meeting with a project navigates there (การประชุม tab); one with no project has nowhere to
  // navigate to, so it opens its own read-only detail view instead (see MeetingDetailModal).
  const openMeeting = (meeting: Meeting) => {
    if (meeting.projectId) goToProjectTab(meeting.projectId, 'meetings');
    else setViewingMeeting(meeting);
  };

  const monthsThai = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];

  const daysOfWeek = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

  // Calculate days in the current month
  const calendarGrid = useMemo(() => {
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
    const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const totalDaysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

    const cells: { date: Date; isCurrentMonth: boolean; key: string }[] = [];

    // Prev month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = totalDaysInPrevMonth - i;
      const date = new Date(currentYear, currentMonth - 1, d);
      cells.push({
        date,
        isCurrentMonth: false,
        key: `prev-${d}`
      });
    }

    // Current month days
    for (let d = 1; d <= totalDaysInMonth; d++) {
      const date = new Date(currentYear, currentMonth, d);
      cells.push({
        date,
        isCurrentMonth: true,
        key: `curr-${d}`
      });
    }

    // Next month padding to fill out the grid to a whole number of rows — a month only needs 6
    // rows (42 cells) when firstDayIndex + totalDaysInMonth actually spans that far (e.g. a
    // 31-day month starting on a Saturday); most months fit in 5 rows (35 cells), and hardcoding
    // 42 padded every month's last row with 100% next-month filler even when unneeded.
    const totalRows = Math.ceil(cells.length / 7);
    const remainingCells = totalRows * 7 - cells.length;
    for (let d = 1; d <= remainingCells; d++) {
      const date = new Date(currentYear, currentMonth + 1, d);
      cells.push({
        date,
        isCurrentMonth: false,
        key: `next-${d}`
      });
    }

    return { cells, totalRows };
  }, [currentYear, currentMonth]);

  const handlePrevMonth = () => {
    setOpenDayKey(null);
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    setOpenDayKey(null);
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  // Real project tasks mapped into the common CalendarTaskItem shape the grid/popover/upcoming-
  // list below deal with. No department field to filter project tasks by — shown regardless of
  // the department dropdown.
  const allCalendarTasks = useMemo<CalendarTaskItem[]>(() => {
    const fromProjectTasks: CalendarTaskItem[] = projectTasks
      .filter((t) => t.dueDateISO)
      .filter((t) => isMineOnly(t.assigneeEmployeeIds))
      .map((t) => ({
        id: `ptask-${t.id}`,
        title: t.title,
        dueDateISO: t.dueDateISO as string,
        startDateISO: t.startDateISO ?? null,
        colorClasses: 'border',
        colorHex: TASK_STATUS_COLOR[t.status],
        projectLabel: projectById.get(t.projectId)?.title ?? 'ไม่ทราบโครงการ',
        projectId: t.projectId,
        assigneeNames: namesFor(t.assigneeEmployeeIds),
      }));

    return fromProjectTasks;
  }, [projectTasks, projectById, employeeById, scope, currentUserId]);

  // Check if a date has tasks falling on it
  const getTasksOnDate = (date: Date) => {
    const dateString = toLocalDateString(date);
    return allCalendarTasks.filter(task => {
      if (task.startDateISO) {
        if (task.startDateISO <= dateString && task.dueDateISO >= dateString) return true;
      } else if (task.dueDateISO === dateString) {
        return true;
      }

      return false;
    });
  };

  // Check if a date has meetings scheduled on it — meetings created from a project's "เพิ่มงาน"
  // modal (see AddTaskModal.tsx's "การประชุม" tab) land here via AppDataContext's shared
  // `meetings` state, the same record shown on that project's own "การประชุม" tab.
  const isMyMeeting = (meeting: Meeting) => isMineOnly([meeting.createdBy ?? '', ...meeting.attendeeIds]);
  const scopedProjects = useMemo(
    () => (scope === 'all' ? projects : projects.filter((p) => isResponsibleForProject(p, currentUserId))),
    [projects, scope, currentUserId]
  );

  const getMeetingsOnDate = (date: Date) => {
    const dateString = toLocalDateString(date);
    return meetings.filter(meeting => meeting.date === dateString && isMyMeeting(meeting));
  };

  // A project's own deadline (endDate) — shown as its own marker on the day it's due, separate
  // from its tasks. The dedicated "เฉพาะโครงการ" filter switches to a full Gantt timeline instead
  // (see the render below) since a single-day marker doesn't convey a project's actual duration.
  const getProjectsOnDate = (date: Date) => {
    const dateString = toLocalDateString(date);
    return scopedProjects.filter((p) => p.endDateISO === dateString);
  };

  const todayString = toLocalDateString(new Date());

  // A quick-glance feed of what's coming up across the whole future, not just whichever month
  // happens to be on screen — fills what would otherwise be dead space under the department
  // filter, and follows the same filterType/selectedDept scope as the grid above it so the two
  // never disagree about what "the current view" means.
  const upcomingItems = useMemo<UpcomingItem[]>(() => {
    const items: UpcomingItem[] = [];
    // "เฉพาะโครงการ" swaps the whole main area to a Gantt timeline (see the render below), so the
    // sidebar switches with it to upcoming project deadlines instead of tasks/meetings.
    if (filterType === 'Projects') {
      scopedProjects.forEach((p) => {
        if (!p.endDateISO || p.endDateISO < todayString) return;
        items.push({ kind: 'project', sortKey: `${p.endDateISO}T99:99`, project: p });
      });
      return items.sort((a, b) => a.sortKey.localeCompare(b.sortKey)).slice(0, 6);
    }
    if (filterType !== 'Meetings') {
      allCalendarTasks.forEach((task) => {
        if (task.dueDateISO < todayString) return;
        items.push({ kind: 'task', sortKey: `${task.dueDateISO}T99:99`, task });
      });
    }
    if (filterType !== 'Tasks') {
      meetings.forEach((meeting) => {
        if (meeting.date < todayString) return;
        if (!isMyMeeting(meeting)) return;
        items.push({ kind: 'meeting', sortKey: `${meeting.date}T${meeting.startTime}`, meeting });
      });
    }
    return items.sort((a, b) => a.sortKey.localeCompare(b.sortKey)).slice(0, 6);
  }, [allCalendarTasks, meetings, scopedProjects, filterType, todayString, scope, currentUserId]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:h-full" id="calendar-tab">

      {/* Sidebar: Calendar Filters */}
      {/* On phones the calendar itself comes first and the filters follow it. */}
      <div className="lg:col-span-1 min-h-0 max-lg:order-last">

        {/* Calendar View Filters — h-full/flex-col so this card's bottom edge lines up with the
            (much taller, always-6-rows) calendar card next to it, instead of stopping short. */}
        <div className="lg:h-full flex flex-col bg-white p-5 rounded-2xl border border-slate-100 shadow-[0px_2px_7px_-1px_rgba(0,0,0,0.1)] space-y-4">
          <button
            type="button"
            onClick={() => setIsScheduleMeetingOpen(true)}
            className="w-full h-10 flex items-center justify-center gap-1.5 bg-[#FF6537] hover:bg-[#e6572c] text-white text-sm font-bold rounded-xl cursor-pointer transition-colors"
          >
            <Users2 size={15} /> นัดประชุม
          </button>

          <div className="flex items-center gap-0.5 bg-white border border-slate-200 rounded-xl p-1">
            <button
              type="button"
              onClick={() => setScope('mine')}
              className={`flex-1 text-xs font-semibold h-8 rounded-lg cursor-pointer transition-colors ${
                scope === 'mine' ? 'bg-[#FF6537] text-white' : 'text-[#6F6F6F] hover:text-[#272220]'
              }`}
            >
              เฉพาะของฉัน
            </button>
            <button
              type="button"
              onClick={() => setScope('all')}
              className={`flex-1 text-xs font-semibold h-8 rounded-lg cursor-pointer transition-colors ${
                scope === 'all' ? 'bg-[#FF6537] text-white' : 'text-[#6F6F6F] hover:text-[#272220]'
              }`}
            >
              ภาพรวมทั้งบริษัท
            </button>
          </div>

          <h3 className="text-sm font-bold text-[#272220] flex items-center gap-1.5">
            <CalIcon size={16} className="text-[#FF6537]" /> ตัวกรองปฏิทิน
          </h3>

          <div className="flex flex-col gap-1 bg-white border border-slate-200 rounded-xl p-1">
            {FILTER_OPTIONS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilterType(value)}
                className={`flex items-center gap-2 w-full text-left text-xs px-3 h-8 rounded-lg font-semibold cursor-pointer transition-colors ${
                  filterType === value
                    ? 'bg-[#FF6537] text-white'
                    : 'text-[#6F6F6F] hover:text-[#272220]'
                }`}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>

          {filterType !== 'Projects' && (
            <div className="pt-3 border-t border-slate-100">
              <label className="block text-[11px] font-bold text-[#272220] mb-1.5">แยกตามแผนก</label>
              <Dropdown<string>
                value={selectedDept}
                onChange={setSelectedDept}
                options={[
                  { value: 'All', label: 'ทุกแผนก' },
                  ...orgSections.map((section) => ({ value: section, label: section }))
                ]}
              />
            </div>
          )}

          {/* งานและการประชุมที่ใกล้ถึง — the department dropdown used to just trail off into empty
              white space below it; this reuses the same tasks/meetings already loaded for the
              grid to answer the question the sidebar exists for ("what's coming up"), without
              needing to hunt across months of grid cells to find it. Switches to upcoming project
              deadlines when the "เฉพาะโครงการ" filter (and its Gantt view) is active. */}
          <div className="pt-3 border-t border-slate-100 flex-1 min-h-0 flex flex-col">
            <p className="text-[11px] font-bold text-[#272220] shrink-0">
              {filterType === 'Projects' ? 'โครงการที่ใกล้ครบกำหนด' : 'งานและการประชุมที่ใกล้ถึง'}
            </p>
            <div className="mt-2.5 space-y-2.5 overflow-y-auto">
            {upcomingItems.length === 0 ? (
              <p className="text-xs text-[#A0A0A0] text-center py-2">
                {filterType === 'Projects' ? 'ไม่มีโครงการที่ใกล้ครบกำหนด' : 'ไม่มีงานหรือการประชุมที่ใกล้ถึง'}
              </p>
            ) : (
              upcomingItems.map((item) => {
                if (item.kind === 'task') {
                  // Only a real project_task (item.task.projectId set) has anywhere to navigate to
                  // — the older, free-text-project Task model has no matching id to link against.
                  const content = (
                    <>
                      <p className="font-semibold text-[#272220] truncate flex items-center gap-1">
                        {item.task.title}
                      </p>
                      <p className={`text-[11px] truncate ${item.task.projectId ? 'text-[#FF6537] group-hover:underline' : 'text-[#A0A0A0]'}`}>
                        {formatThaiDateShort(item.task.dueDateISO)} · {item.task.projectLabel}
                      </p>
                    </>
                  );
                  return item.task.projectId ? (
                    <button
                      key={`t-${item.task.id}`}
                      type="button"
                      onClick={() => goToProjectTab(item.task.projectId!, 'overview')}
                      className="w-full text-left text-xs min-w-0 group cursor-pointer"
                    >
                      {content}
                    </button>
                  ) : (
                    <div key={`t-${item.task.id}`} className="text-xs min-w-0">
                      {content}
                    </div>
                  );
                }
                if (item.kind === 'project') {
                  const StatusIcon = STATUS_ICON[item.project.status];
                  return (
                    <button
                      key={`p-${item.project.id}`}
                      type="button"
                      onClick={() => goToProject(item.project.id)}
                      className="w-full text-left text-xs min-w-0 group cursor-pointer"
                    >
                      <p className="font-semibold text-[#272220] truncate flex items-center gap-1">
                        <Briefcase size={10} className="shrink-0" style={{ color: STATUS_DOT[item.project.status] }} />
                        {item.project.title}
                      </p>
                      <p className="text-[11px] text-[#FF6537] group-hover:underline truncate flex items-center gap-1">
                        {item.project.endDate}
                        <StatusIcon size={10} className="shrink-0" />
                        {STATUS_LABEL[item.project.status]}
                      </p>
                    </button>
                  );
                }
                const project = item.meeting.projectId ? projectById.get(item.meeting.projectId) : undefined;
                const isCancelled = item.meeting.status === 'cancelled';
                const isPast = isPastMeeting(item.meeting);
                return (
                  <div key={`m-${item.meeting.id}`} className="w-full flex items-start gap-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => openMeeting(item.meeting)}
                      className={`flex-1 min-w-0 text-left text-xs group cursor-pointer ${isCancelled || isPast ? 'opacity-60' : ''}`}
                    >
                      <p className="font-semibold text-[#272220] truncate flex items-center gap-1">
                        {isCancelled ? <Ban size={10} className="shrink-0 text-red-500" /> : <Users2 size={10} className="shrink-0 text-purple-600" />}
                        <span className={isCancelled || isPast ? 'line-through' : ''}>{item.meeting.title}</span>
                      </p>
                      <p className={`text-[11px] truncate ${isCancelled ? 'text-red-500' : isPast ? 'text-[#A0A0A0]' : project ? 'text-[#FF6537] group-hover:underline' : 'text-[#A0A0A0] group-hover:text-purple-600'}`}>
                        {isCancelled ? 'ยกเลิกแล้ว' : isPast ? 'ผ่านไปแล้ว' : `${formatThaiDateShort(item.meeting.date)} ${item.meeting.startTime}${project ? ` · ${project.title}` : ''}`}
                      </p>
                    </button>
                    {!isCancelled && (
                      <Tooltip content="ยกเลิกประชุม">
                        <button
                          type="button"
                          onClick={() => setCancellingMeeting(item.meeting)}
                          aria-label="ยกเลิกประชุม"
                          className="text-[#A0A0A0] hover:text-red-600 cursor-pointer shrink-0"
                        >
                          <Ban size={12} />
                        </button>
                      </Tooltip>
                    )}
                  </div>
                );
              })
            )}
            </div>
          </div>
        </div>

      </div>

      {/* Main Calendar View Area — h-full/flex-col with the week grid as the one flex-1 child so
          the whole page fits the viewport without a page-level scroll: the nav row, weekday
          header, and legend all keep their natural height, and the 6 week-rows simply divide up
          whatever vertical space is actually left, on any screen size. */}
      <div className="lg:col-span-3 min-h-0 lg:h-full flex flex-col bg-white p-4 sm:p-6 rounded-2xl border border-slate-100 shadow-[0px_2px_7px_-1px_rgba(0,0,0,0.1)]">

        {/* Calendar Nav Header */}
        <div className="shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#FFF1EC] text-[#FF6537] rounded-xl">
              {filterType === 'Projects' ? <Briefcase size={20} /> : <CalIcon size={20} />}
            </div>
            <div>
              <h2 className="text-base font-bold text-[#272220]">
                {filterType === 'Projects' ? 'ภาพรวมโครงการทั้งหมด' : `${monthsThai[currentMonth]} ${currentYear + 543}`}
              </h2>
              <p className="text-xs text-[#6F6F6F]">
                {filterType === 'Projects' ? 'มุมมอง Gantt Chart ของทุกโครงการ' : 'มุมมองปฏิทินแบบบูรณาการ'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Month navigation doesn't apply to the Gantt view — it always shows every project
                regardless of month. */}
            {filterType !== 'Projects' && (
            <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-[#6F6F6F] hover:text-[#272220] cursor-pointer transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => {
                setOpenDayKey(null);
                setCurrentMonth(new Date().getMonth());
                setCurrentYear(new Date().getFullYear());
              }}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-[#6F6F6F] hover:text-[#272220] cursor-pointer transition-colors"
            >
              วันนี้
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-[#6F6F6F] hover:text-[#272220] cursor-pointer transition-colors"
            >
              <ChevronRight size={16} />
            </button>
            </div>
            )}
          </div>
        </div>

        {filterType === 'Projects' ? (
          <div className="mt-4 flex-1 min-h-0 max-lg:flex-none max-lg:h-[26rem] flex flex-col border border-slate-100 rounded-xl">
            <ProjectsGanttChart projects={scopedProjects} projectTasks={projectTasks} onSelectProject={goToProject} />
          </div>
        ) : (
        <>
        {/* Days of Week Header Grid */}
        <div className="shrink-0 mt-4 grid grid-cols-7 gap-1 text-center font-bold text-[11px] text-[#A0A0A0] uppercase select-none border-b border-slate-100 pb-2">
          {daysOfWeek.map((day) => (
            <div key={day}>
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Month Cell Grid — a real 5 or 6 equal-height rows (whatever the month actually
            needs, see calendarGrid's totalRows) that share the flex-1 space evenly, so the grid
            always exactly fills its container with no inner scrollbar. minmax(0, 1fr), not
            minmax(70px, 1fr) — a fixed floor is what forced a scrollbar whenever N × 70px didn't
            fit; a cramped row still reads fine since chip overflow already collapses into
            "+N more" and the click-to-expand popover. Hardcoding 6 rows regardless of the actual
            month used to pad most months' last row with 100% next-month filler. */}
        <div
          ref={gridRef}
          className="flex-1 min-h-0 max-lg:flex-none max-lg:h-[23rem] mt-1.5 grid grid-cols-7 gap-1.5"
          style={{ gridTemplateRows: `repeat(${calendarGrid.totalRows}, minmax(0, 1fr))` }}
        >
          {calendarGrid.cells.map((cell, index) => {
            const hasTasks = filterType !== 'Meetings' ? getTasksOnDate(cell.date) : [];
            const hasMeetings = filterType !== 'Tasks' ? getMeetingsOnDate(cell.date) : [];
            // Only shown on "แสดงทุกอย่าง" — the dedicated "เฉพาะโครงการ" filter replaces the whole
            // grid with the Gantt timeline instead (see the render above the grid).
            const hasProjectDeadlines = filterType === 'All' ? getProjectsOnDate(cell.date) : [];
            const hasAnything = hasTasks.length > 0 || hasMeetings.length > 0 || hasProjectDeadlines.length > 0;
            // One combined cap across every kind, not a separate 2/2/1 slice per kind — a day with
            // e.g. 2 tasks + 2 meetings used to be able to show 4 chips at once regardless of how
            // cramped the cell actually is. Order: tasks, then meetings, then deadlines (unchanged
            // from before), just sliced together instead of independently.
            const dayChipItems: DayChipItem[] = [
              ...hasTasks.map((task): DayChipItem => ({ kind: 'task', key: `t-${task.id}`, task })),
              ...hasMeetings.map((meeting): DayChipItem => ({ kind: 'meeting', key: `m-${meeting.id}`, meeting })),
              ...hasProjectDeadlines.map((project): DayChipItem => ({ kind: 'project', key: `p-${project.id}`, project })),
            ];
            const visibleDayChips = dayChipItems.slice(0, 2);
            const hiddenDayChipCount = dayChipItems.length - visibleDayChips.length;
            const isToday = cell.date.toDateString() === new Date().toDateString();
            const isOpen = openDayKey === cell.key;
            // Opens beside the cell, not below it — below used to drop the popover on top of the
            // next row's cells. Defaults to the right/downward; flips near the grid's right edge
            // or bottom rows so it never runs off the card. The flip threshold keys off the grid's
            // real row count (not a literal 4) so it still flips correctly on a 5-row month.
            const col = index % 7;
            const row = Math.floor(index / 7);
            const popoverHorizontal = col >= 4 ? 'right-full mr-1.5' : 'left-full ml-1.5';
            const popoverVertical = row >= calendarGrid.totalRows - 2 ? 'bottom-0' : 'top-0';

            return (
              <div
                key={cell.key}
                className={`relative p-1.5 border rounded-xl flex flex-col justify-between transition-colors min-h-0 ${
                  hasAnything ? 'cursor-pointer' : ''
                } ${
                  cell.isCurrentMonth ? 'bg-white' : 'bg-slate-50/40 text-slate-300'
                } ${isToday ? 'ring-2 ring-[#FF6537] ring-offset-1' : ''} ${
                  isOpen ? 'border-[#FF6537]' : 'border-slate-100 hover:bg-slate-50'
                }`}
                onClick={() => hasAnything && setOpenDayKey((prev) => (prev === cell.key ? null : cell.key))}
              >
                {/* Date Number Indicator */}
                <div className="flex justify-between items-center">
                  <span className={`text-xs font-bold ${
                    isToday
                      ? 'bg-[#FF6537] text-white w-5 h-5 flex items-center justify-center rounded-full'
                      : cell.isCurrentMonth ? 'text-[#272220]' : 'text-slate-400'
                  }`}>
                    {cell.date.getDate()}
                  </span>

                  {/* Little helper badge count */}
                  {hasAnything && cell.isCurrentMonth && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#FF6537]"></span>
                  )}
                </div>

                {/* Grid Events container */}
                {/* overflow-hidden, not overflow-y-auto — a scrollbar inside a cell this small
                    just looks broken; clipping cleanly and letting the "+N more"/click-to-expand
                    popover carry any overflow reads far more balanced. */}
                <div className="mt-1.5 flex flex-col gap-1 overflow-hidden flex-1 min-h-0">

                  {/* Up to 2 chips total across every kind (see dayChipItems above), plus one
                      combined "+N" indicator for whatever didn't fit — replaces the old per-kind
                      2/2/1 slicing, which could stack up to 4-5 chips into one tiny cell. */}
                  {visibleDayChips.map((item) => {
                    if (item.kind === 'task') {
                      const task = item.task;
                      return (
                        <Tooltip key={item.key} content={`[${task.projectLabel}] ${task.title}`}>
                          <div
                            className={`text-[9px] px-1.5 py-0.5 rounded-lg border truncate font-medium ${task.colorClasses}`}
                            style={task.colorHex ? { backgroundColor: `${task.colorHex}1A`, color: task.colorHex, borderColor: `${task.colorHex}33` } : undefined}
                          >
                            {task.title}
                          </div>
                        </Tooltip>
                      );
                    }
                    if (item.kind === 'meeting') {
                      const meeting = item.meeting;
                      const isCancelled = meeting.status === 'cancelled';
                      const isPast = isPastMeeting(meeting);
                      return (
                        <Tooltip
                          key={item.key}
                          content={isCancelled ? `ยกเลิกแล้ว: ${meeting.title}` : isPast ? `ผ่านไปแล้ว: ${meeting.title}` : `${meeting.startTime} ${meeting.title}`}
                        >
                          <div
                            className={`text-[9px] px-1.5 py-0.5 rounded-lg border truncate font-medium flex items-center gap-0.5 ${
                              isCancelled || isPast ? 'bg-slate-50 text-slate-400 border-slate-200' : 'bg-purple-50 text-purple-700 border-purple-200'
                            }`}
                          >
                            {isCancelled ? <Ban size={9} className="shrink-0" /> : <Users2 size={9} className="shrink-0" />}
                            <span className={isCancelled || isPast ? 'line-through' : ''}>{meeting.startTime} {meeting.title}</span>
                          </div>
                        </Tooltip>
                      );
                    }
                    const project = item.project;
                    return (
                      <Tooltip key={item.key} content={`ครบกำหนดโครงการ: ${project.title}`}>
                        <div
                          className="text-[9px] px-1.5 py-0.5 rounded-lg border truncate font-medium flex items-center gap-0.5"
                          style={{ backgroundColor: `${STATUS_DOT[project.status]}1A`, color: STATUS_DOT[project.status], borderColor: `${STATUS_DOT[project.status]}33` }}
                        >
                          <Briefcase size={9} className="shrink-0" />
                          {project.title}
                        </div>
                      </Tooltip>
                    );
                  })}

                  {/* Excess items hidden indicator — one combined count, not per-kind. Pinned to
                      the bottom of the cell (mt-auto) instead of stacking directly under the last
                      visible chip, so a light day's leftover space reads as "more below" rather
                      than an unexplained gap under a cramped little stack of chips. */}
                  {hiddenDayChipCount > 0 && (
                    <div className="mt-auto text-[8px] text-center text-[#A0A0A0] font-bold bg-slate-50 py-0.5 rounded-lg">
                      +{hiddenDayChipCount}
                    </div>
                  )}

                </div>

                {/* Full day detail popover — opened by clicking a cell that has anything on it.
                    Shows every task/meeting for the day (not just the first 2) plus which
                    project each is from; a meeting's project is a real, clickable link (it
                    stores a real projectId), a task's is shown as plain text only. */}
                {isOpen && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className={`absolute z-30 ${popoverVertical} ${popoverHorizontal} w-80 max-h-96 overflow-y-auto bg-white border border-slate-200 rounded-2xl shadow-xl text-left cursor-default`}
                  >
                    <div className="flex items-center justify-between px-3.5 py-3 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl">
                      <p className="text-xs font-bold text-[#272220]">
                        {cell.date.getDate()} {monthsThai[cell.date.getMonth()]} {cell.date.getFullYear() + 543}
                      </p>
                      <button
                        type="button"
                        onClick={() => setOpenDayKey(null)}
                        className="text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    <div className="p-3 space-y-3">
                      {hasTasks.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-bold text-[#A0A0A0] uppercase tracking-wide px-0.5">งาน</p>
                          {hasTasks.map((task) => (
                            <div key={task.id} className="flex items-start gap-2 p-2 rounded-lg bg-slate-50">
                              <span className="w-6 h-6 rounded-lg bg-[#FFF1EC] text-[#FF6537] flex items-center justify-center shrink-0">
                                <ListChecks size={12} />
                              </span>
                              <div className="min-w-0 text-xs">
                                <p className="font-semibold text-[#272220] flex items-center gap-1">
                                  {task.title}
                                </p>
                                <p className="text-[11px] text-[#A0A0A0] mt-0.5">โครงการ: {task.projectLabel}</p>
                                <p className="text-[11px] text-[#A0A0A0] mt-0.5">ผู้รับผิดชอบ: {task.assigneeNames ?? 'ยังไม่ระบุ'}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {hasTasks.length > 0 && hasMeetings.length > 0 && (
                        <div className="border-t border-slate-100" />
                      )}

                      {hasMeetings.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-bold text-[#A0A0A0] uppercase tracking-wide px-0.5">การประชุม</p>
                          {hasMeetings.map((meeting) => {
                            const project = meeting.projectId ? projectById.get(meeting.projectId) : undefined;
                            const isCancelled = meeting.status === 'cancelled';
                            const isPast = isPastMeeting(meeting);
                            return (
                              <div
                                key={meeting.id}
                                className={`w-full flex items-start gap-1 p-2 rounded-lg bg-slate-50 transition-colors ${isCancelled || isPast ? 'opacity-60' : 'hover:bg-purple-50'}`}
                              >
                                <button
                                  type="button"
                                  onClick={() => openMeeting(meeting)}
                                  className="flex items-start gap-2 flex-1 min-w-0 text-left cursor-pointer group"
                                >
                                  <span className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${isCancelled ? 'bg-red-50 text-red-500' : isPast ? 'bg-slate-100 text-slate-400' : 'bg-purple-50 text-purple-600'}`}>
                                    {isCancelled ? <Ban size={12} /> : <Users2 size={12} />}
                                  </span>
                                  <div className="min-w-0 flex-1 text-xs">
                                    <p className={`font-semibold text-[#272220] ${isCancelled || isPast ? 'line-through' : ''}`}>{meeting.startTime} {meeting.title}</p>
                                    {isCancelled ? (
                                      <p className="text-[11px] text-red-500 font-medium mt-0.5">
                                        ยกเลิกแล้ว{meeting.cancellationReason ? `: ${meeting.cancellationReason}` : ''}
                                      </p>
                                    ) : isPast ? (
                                      <p className="text-[11px] text-[#A0A0A0] mt-0.5">ผ่านไปแล้ว</p>
                                    ) : project ? (
                                      <p className="text-[11px] text-[#FF6537] font-medium mt-0.5 group-hover:underline">โครงการ: {project.title}</p>
                                    ) : (
                                      <p className="text-[11px] text-[#A0A0A0] group-hover:text-purple-600 mt-0.5">ไม่ได้ผูกกับโครงการ · ดูรายละเอียด</p>
                                    )}
                                  </div>
                                </button>
                                {!isCancelled && !isPast && (
                                  <Tooltip content="ยกเลิกประชุม">
                                    <button
                                      type="button"
                                      onClick={() => setCancellingMeeting(meeting)}
                                      aria-label="ยกเลิกประชุม"
                                      className="text-[#A0A0A0] hover:text-red-600 cursor-pointer shrink-0 p-1"
                                    >
                                      <Ban size={13} />
                                    </button>
                                  </Tooltip>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {(hasTasks.length > 0 || hasMeetings.length > 0) && hasProjectDeadlines.length > 0 && (
                        <div className="border-t border-slate-100" />
                      )}

                      {hasProjectDeadlines.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-bold text-[#A0A0A0] uppercase tracking-wide px-0.5">ครบกำหนดโครงการ</p>
                          {hasProjectDeadlines.map((project) => {
                            const StatusIcon = STATUS_ICON[project.status];
                            const dotColor = STATUS_DOT[project.status];
                            return (
                              <button
                                key={project.id}
                                type="button"
                                onClick={() => goToProject(project.id)}
                                className="w-full flex items-start gap-2 p-2 rounded-lg bg-slate-50 text-left hover:bg-[#FFF1EC] cursor-pointer group transition-colors"
                              >
                                <span
                                  className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                                  style={{ backgroundColor: `${dotColor}1A`, color: dotColor }}
                                >
                                  <Briefcase size={12} />
                                </span>
                                <div className="min-w-0 flex-1 text-xs">
                                  <p className="font-semibold text-[#272220] group-hover:text-[#FF6537]">{project.title}</p>
                                  <p className="text-[11px] text-[#A0A0A0] mt-0.5 flex items-center gap-1">
                                    <StatusIcon size={10} />
                                    {STATUS_LABEL[project.status]}
                                  </p>
                                </div>
                                <ChevronRight size={14} className="shrink-0 text-slate-300 mt-1 group-hover:text-[#FF6537]" />
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

              </div>
            );
          })}
        </div>

        {/* Legend Information — task-status swatches are inline-styled from TASK_STATUS_COLOR
            (the canonical palette ProjectDetail/ProjectGantt/MyWorkspace already color these same
            statuses with), replacing what used to be an independent, disconnected set of pastel
            Tailwind colors that didn't match the actual task chips shown in the grid above. */}
        <div className="shrink-0 mt-4 pt-4 border-t border-slate-100 flex flex-wrap gap-4 text-xs text-[#6F6F6F]">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full block" style={{ backgroundColor: `${TASK_STATUS_COLOR.todo}1A`, border: `1px solid ${TASK_STATUS_COLOR.todo}` }}></span>
            <span>{TASK_STATUS_LABEL.todo}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full block" style={{ backgroundColor: `${TASK_STATUS_COLOR.in_progress}1A`, border: `1px solid ${TASK_STATUS_COLOR.in_progress}` }}></span>
            <span>{TASK_STATUS_LABEL.in_progress}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full block" style={{ backgroundColor: `${TASK_STATUS_COLOR.review}1A`, border: `1px solid ${TASK_STATUS_COLOR.review}` }}></span>
            <span>{TASK_STATUS_LABEL.review}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full block" style={{ backgroundColor: `${TASK_STATUS_COLOR.done}1A`, border: `1px solid ${TASK_STATUS_COLOR.done}` }}></span>
            <span>{TASK_STATUS_LABEL.done}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full block" style={{ backgroundColor: `${TASK_STATUS_COLOR.blocked}1A`, border: `1px solid ${TASK_STATUS_COLOR.blocked}` }}></span>
            <span>{TASK_STATUS_LABEL.blocked}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-50 border border-purple-200 block"></span>
            <span>การประชุม</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Briefcase size={12} className="text-[#6F6F6F]" />
            <span>ครบกำหนดโครงการ</span>
          </div>
        </div>
        </>
        )}

      </div>

      <ScheduleMeetingModal
        isOpen={isScheduleMeetingOpen || Boolean(editingMeeting)}
        onClose={() => { setIsScheduleMeetingOpen(false); setEditingMeeting(null); }}
        projects={projects}
        employees={employees}
        currentUserId={currentUser?.id ?? ''}
        onAddMeeting={handleAddMeeting}
        orgSections={orgSections}
        meetingToEdit={editingMeeting}
        onUpdateMeeting={handleUpdateMeeting}
      />

      <CancelMeetingModal
        meeting={cancellingMeeting}
        onClose={() => setCancellingMeeting(null)}
        onConfirm={handleUpdateMeeting}
      />

      <MeetingDetailModal
        meeting={viewingMeeting}
        employees={employees}
        onClose={() => setViewingMeeting(null)}
        onEdit={(m) => { setViewingMeeting(null); setEditingMeeting(m); }}
      />

    </div>
  );
}
