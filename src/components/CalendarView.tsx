import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Task, Meeting } from '../types';
import { useAppData } from '../context/AppDataContext';
import {
  Calendar as CalIcon,
  ChevronLeft,
  ChevronRight,
  ListChecks,
  Users2,
  RefreshCw,
  X
} from 'lucide-react';
import Dropdown from './Dropdown';

interface CalendarViewProps {
  tasks: Task[];
}

type FilterType = 'All' | 'Tasks' | 'Meetings';

const FILTER_OPTIONS: { value: FilterType; label: string; icon: typeof CalIcon }[] = [
  { value: 'All', label: 'แสดงทุกอย่าง', icon: CalIcon },
  { value: 'Tasks', label: 'เฉพาะกำหนดการส่งงาน', icon: ListChecks },
  { value: 'Meetings', label: 'เฉพาะวันนัดประชุม', icon: Users2 },
];

type UpcomingItem =
  | { kind: 'task'; sortKey: string; task: Task }
  | { kind: 'meeting'; sortKey: string; meeting: Meeting };

export default function CalendarView({
  tasks
}: CalendarViewProps) {
  const { orgSections, meetings, projects, setTaskSelectedProjectId } = useAppData();
  const navigate = useNavigate();
  const [currentYear, setCurrentYear] = useState(2026);
  const [currentMonth, setCurrentMonth] = useState(6); // 6 = July (0-indexed, so 5 is June, 6 is July)

  const [filterType, setFilterType] = useState<FilterType>('All');
  const [selectedDept, setSelectedDept] = useState<string>('All');

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

  // Real for meetings (which store a real projectId into the DB-backed `project` table), not
  // available for tasks from the older Task/Gantt/Calendar data model (its `project` field is
  // just a free-text label with no matching id to link to).
  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const goToProject = (projectId: string) => {
    setTaskSelectedProjectId(projectId);
    navigate('/tasks');
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

    // Next month padding to fill grid (usually 42 cells for 6 rows)
    const totalCells = cells.length;
    const remainingCells = 42 - totalCells;
    for (let d = 1; d <= remainingCells; d++) {
      const date = new Date(currentYear, currentMonth + 1, d);
      cells.push({
        date,
        isCurrentMonth: false,
        key: `next-${d}`
      });
    }

    return cells;
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

  // Check if a date has tasks falling on it
  const getTasksOnDate = (date: Date) => {
    const dateString = date.toISOString().split('T')[0];
    return tasks.filter(task => {
      // Filter by department if selected
      if (selectedDept !== 'All' && task.department !== selectedDept) return false;

      // Regular check
      if (task.startDate <= dateString && task.dueDate >= dateString) {
        return true;
      }

      // Check recurring weekly (if date matches start day of week)
      if (task.recurringPattern === 'Weekly') {
        const startDay = new Date(task.startDate).getDay();
        if (date.getDay() === startDay && dateString >= task.startDate) {
          return true;
        }
      }

      // Check recurring monthly (if date matches start date day)
      if (task.recurringPattern === 'Monthly') {
        const startDayNum = new Date(task.startDate).getDate();
        if (date.getDate() === startDayNum && dateString >= task.startDate) {
          return true;
        }
      }

      return false;
    });
  };

  // Check if a date has meetings scheduled on it — meetings created from a project's "เพิ่มงาน"
  // modal (see AddTaskModal.tsx's "การประชุม" tab) land here via AppDataContext's shared
  // `meetings` state, the same record shown on that project's own "การประชุม" tab.
  const getMeetingsOnDate = (date: Date) => {
    const dateString = date.toISOString().split('T')[0];
    return meetings.filter(meeting => meeting.date === dateString);
  };

  const getTaskStatusColor = (status: string) => {
    switch (status) {
      case 'Completed': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'In Progress': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'On Hold': return 'bg-rose-50 text-rose-700 border-rose-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const todayString = new Date().toISOString().split('T')[0];

  // A quick-glance feed of what's coming up across the whole future, not just whichever month
  // happens to be on screen — fills what would otherwise be dead space under the department
  // filter, and follows the same filterType/selectedDept scope as the grid above it so the two
  // never disagree about what "the current view" means.
  const upcomingItems = useMemo<UpcomingItem[]>(() => {
    const items: UpcomingItem[] = [];
    if (filterType !== 'Meetings') {
      tasks.forEach((task) => {
        if (task.dueDate < todayString) return;
        if (selectedDept !== 'All' && task.department !== selectedDept) return;
        items.push({ kind: 'task', sortKey: `${task.dueDate}T99:99`, task });
      });
    }
    if (filterType !== 'Tasks') {
      meetings.forEach((meeting) => {
        if (meeting.date < todayString) return;
        items.push({ kind: 'meeting', sortKey: `${meeting.date}T${meeting.startTime}`, meeting });
      });
    }
    return items.sort((a, b) => a.sortKey.localeCompare(b.sortKey)).slice(0, 6);
  }, [tasks, meetings, filterType, selectedDept, todayString]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full" id="calendar-tab">

      {/* Sidebar: Calendar Filters */}
      <div className="lg:col-span-1 min-h-0">

        {/* Calendar View Filters — h-full/flex-col so this card's bottom edge lines up with the
            (much taller, always-6-rows) calendar card next to it, instead of stopping short. */}
        <div className="h-full flex flex-col bg-white p-5 rounded-2xl border border-slate-100 shadow-[0px_2px_7px_-1px_rgba(0,0,0,0.1)] space-y-4">
          <h3 className="text-sm font-bold text-[#272220] flex items-center gap-1.5">
            <CalIcon size={16} className="text-[#FF6537]" /> ตัวกรองปฏิทิน
          </h3>

          <div className="flex flex-col gap-1 bg-[#F4F4F5] rounded-xl p-1">
            {FILTER_OPTIONS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilterType(value)}
                className={`flex items-center gap-2 w-full text-left text-xs px-3 h-9 rounded-lg font-semibold cursor-pointer transition-colors ${
                  filterType === value
                    ? 'bg-white text-[#272220] shadow-[0px_1px_3px_rgba(0,0,0,0.08)]'
                    : 'text-[#6F6F6F] hover:text-[#272220]'
                }`}
              >
                <Icon size={14} className={filterType === value ? 'text-[#FF6537]' : ''} />
                {label}
              </button>
            ))}
          </div>

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

          {/* งานและการประชุมที่ใกล้ถึง — the department dropdown used to just trail off into empty
              white space below it; this reuses the same tasks/meetings already loaded for the
              grid to answer the question the sidebar exists for ("what's coming up"), without
              needing to hunt across months of grid cells to find it. */}
          <div className="pt-3 border-t border-slate-100 flex-1 min-h-0 flex flex-col">
            <p className="text-[11px] font-bold text-[#272220] shrink-0">งานและการประชุมที่ใกล้ถึง</p>
            <div className="mt-2.5 space-y-2.5 overflow-y-auto">
            {upcomingItems.length === 0 ? (
              <p className="text-xs text-[#A0A0A0] text-center py-2">ไม่มีงานหรือการประชุมที่ใกล้ถึง</p>
            ) : (
              upcomingItems.map((item) => {
                if (item.kind === 'task') {
                  return (
                    <div key={`t-${item.task.id}`} className="text-xs min-w-0">
                      <p className="font-semibold text-[#272220] truncate flex items-center gap-1">
                        {item.task.recurringPattern !== 'None' && <RefreshCw size={10} className="shrink-0 text-[#FF6537]" />}
                        {item.task.title}
                      </p>
                      <p className="text-[11px] text-[#A0A0A0] truncate">{item.task.dueDate} · {item.task.project}</p>
                    </div>
                  );
                }
                const project = item.meeting.projectId ? projectById.get(item.meeting.projectId) : undefined;
                return (
                  <button
                    key={`m-${item.meeting.id}`}
                    type="button"
                    onClick={() => project && goToProject(project.id)}
                    disabled={!project}
                    className={`w-full text-left text-xs min-w-0 group ${project ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    <p className="font-semibold text-[#272220] truncate flex items-center gap-1">
                      <Users2 size={10} className="shrink-0 text-purple-600" /> {item.meeting.title}
                    </p>
                    <p className={`text-[11px] truncate ${project ? 'text-[#FF6537] group-hover:underline' : 'text-[#A0A0A0]'}`}>
                      {item.meeting.date} {item.meeting.startTime}{project ? ` · ${project.title}` : ''}
                    </p>
                  </button>
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
      <div className="lg:col-span-3 min-h-0 h-full flex flex-col bg-white p-6 rounded-2xl border border-slate-100 shadow-[0px_2px_7px_-1px_rgba(0,0,0,0.1)]">

        {/* Calendar Nav Header */}
        <div className="shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#FFF1EC] text-[#FF6537] rounded-xl">
              <CalIcon size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#272220]">
                {monthsThai[currentMonth]} {currentYear + 543}
              </h2>
              <p className="text-xs text-[#6F6F6F]">
                ปีคริสต์ศักราช {currentYear} · มุมมองปฏิทินแบบบูรณาการ
              </p>
            </div>
          </div>

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
        </div>

        {/* Days of Week Header Grid */}
        <div className="shrink-0 mt-4 grid grid-cols-7 gap-1 text-center font-bold text-[11px] text-[#A0A0A0] uppercase select-none border-b border-slate-100 pb-2">
          {daysOfWeek.map((day) => (
            <div key={day}>
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Month Cell Grid — always exactly 6 rows (42 cells). Each row gets *at least*
            70px (enough to show the date number plus a couple of event chips in full — anything
            shorter was clipping a chip mid-line, which read as broken however it was clipped)
            and otherwise shares the flex-1 space evenly. If 6 × 70px genuinely doesn't fit the
            viewport, this small area scrolls on its own — the header/sidebar/legend around it
            stay put, so the *page* still never needs to scroll. */}
        <div
          ref={gridRef}
          className="flex-1 min-h-0 mt-1.5 grid grid-cols-7 gap-1.5 overflow-y-auto"
          style={{ gridTemplateRows: 'repeat(6, minmax(70px, 1fr))' }}
        >
          {calendarGrid.map((cell, index) => {
            const hasTasks = filterType !== 'Meetings' ? getTasksOnDate(cell.date) : [];
            const hasMeetings = filterType !== 'Tasks' ? getMeetingsOnDate(cell.date) : [];
            const hasAnything = hasTasks.length > 0 || hasMeetings.length > 0;
            const isToday = cell.date.toDateString() === new Date().toDateString();
            const isOpen = openDayKey === cell.key;
            // Rightmost 2 columns (ศ/ส) would overflow the card if the popover opened flush left.
            const popoverAlign = index % 7 >= 5 ? 'right-0' : 'left-0';

            return (
              <div
                key={cell.key}
                className={`relative p-1.5 border rounded-xl flex flex-col justify-between transition-colors min-h-0 ${
                  hasAnything ? 'cursor-pointer' : ''
                } ${
                  cell.isCurrentMonth ? 'bg-white' : 'bg-slate-50/40 text-slate-300'
                } ${isToday ? 'ring-2 ring-[#FF6537] ring-offset-1' : ''} ${
                  isOpen ? 'border-[#FF6537]' : 'border-slate-100 hover:bg-slate-50/70'
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
                <div className="mt-1.5 space-y-1 overflow-hidden flex-1 min-h-0">

                  {/* Tasks deadlining/starting */}
                  {hasTasks.slice(0, 2).map(task => (
                    <div
                      key={task.id}
                      className={`text-[9px] px-1.5 py-0.5 rounded-md border truncate font-medium ${getTaskStatusColor(task.status)}`}
                      title={`[${task.project}] ${task.title}`}
                    >
                      {task.recurringPattern !== 'None' && (
                        <RefreshCw size={8} className="inline-block mr-0.5 -mt-0.5 text-[#FF6537]" />
                      )}
                      {task.title}
                    </div>
                  ))}

                  {/* Meetings scheduled */}
                  {hasMeetings.slice(0, 2).map(meeting => (
                    <div
                      key={meeting.id}
                      className="text-[9px] px-1.5 py-0.5 rounded-md border bg-purple-50 text-purple-700 border-purple-200 truncate font-medium flex items-center gap-0.5"
                      title={`${meeting.startTime} ${meeting.title}`}
                    >
                      <Users2 size={9} className="shrink-0" />
                      {meeting.startTime} {meeting.title}
                    </div>
                  ))}

                  {/* Excess Tasks hidden indicator */}
                  {hasTasks.length > 2 && (
                    <div className="text-[8px] text-center text-[#A0A0A0] font-bold bg-slate-50 py-0.2 rounded">
                      + อีก {hasTasks.length - 2} งาน
                    </div>
                  )}

                </div>

                {/* Full day detail popover — opened by clicking a cell that has anything on it.
                    Shows every task/meeting for the day (not just the first 2) plus which
                    project each is from; a meeting's project is a real, clickable link (it
                    stores a real projectId), a task's is shown as plain text only (the older
                    Task data model's `project` field is free text with no id to link to). */}
                {isOpen && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className={`absolute z-30 top-full mt-1.5 ${popoverAlign} w-80 max-h-96 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl text-left cursor-default`}
                  >
                    <div className="flex items-center justify-between px-3.5 py-3 border-b border-slate-100 sticky top-0 bg-white rounded-t-xl">
                      <p className="text-xs font-bold text-[#272220]">
                        {cell.date.getDate()} {monthsThai[cell.date.getMonth()]} {cell.date.getFullYear() + 543}
                      </p>
                      <button
                        type="button"
                        onClick={() => setOpenDayKey(null)}
                        className="text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    <div className="p-3 space-y-3">
                      {hasTasks.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-bold text-[#A0A0A0] uppercase tracking-wide px-0.5">งาน</p>
                          {hasTasks.map((task) => (
                            <div key={task.id} className="flex items-start gap-2 p-2 rounded-lg bg-slate-50">
                              <span className="w-6 h-6 rounded-md bg-[#FFF1EC] text-[#FF6537] flex items-center justify-center shrink-0">
                                <ListChecks size={12} />
                              </span>
                              <div className="min-w-0 text-xs">
                                <p className="font-semibold text-[#272220] flex items-center gap-1">
                                  {task.recurringPattern !== 'None' && <RefreshCw size={10} className="shrink-0 text-[#FF6537]" />}
                                  {task.title}
                                </p>
                                <p className="text-[11px] text-[#A0A0A0] mt-0.5">โครงการ: {task.project}</p>
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
                            return (
                              <button
                                key={meeting.id}
                                type="button"
                                onClick={() => project && goToProject(project.id)}
                                disabled={!project}
                                className={`w-full flex items-start gap-2 p-2 rounded-lg bg-slate-50 text-left transition-colors ${
                                  project ? 'hover:bg-purple-50 cursor-pointer group' : 'cursor-default'
                                }`}
                              >
                                <span className="w-6 h-6 rounded-md bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                                  <Users2 size={12} />
                                </span>
                                <div className="min-w-0 flex-1 text-xs">
                                  <p className="font-semibold text-[#272220]">{meeting.startTime} {meeting.title}</p>
                                  {project ? (
                                    <p className="text-[11px] text-[#FF6537] font-medium mt-0.5 group-hover:underline">โครงการ: {project.title}</p>
                                  ) : (
                                    <p className="text-[11px] text-[#A0A0A0] mt-0.5">ไม่ได้ผูกกับโครงการ</p>
                                  )}
                                </div>
                                {project && <ChevronRight size={14} className="shrink-0 text-purple-400 mt-1 group-hover:text-purple-600" />}
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

        {/* Legend Information */}
        <div className="shrink-0 mt-4 pt-4 border-t border-slate-100 flex flex-wrap gap-4 text-xs text-[#6F6F6F]">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-blue-50 border border-blue-200 block"></span>
            <span>งานกำลังดำเนินการ</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-emerald-50 border border-emerald-200 block"></span>
            <span>งานเสร็จสิ้นแล้ว</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-purple-50 border border-purple-200 block"></span>
            <span>การประชุม</span>
          </div>
          <div className="flex items-center gap-1.5">
            <RefreshCw size={12} className="text-[#FF6537]" />
            <span>ตารางงานแบบเกิดซ้ำ (Weekly/Monthly)</span>
          </div>
        </div>

      </div>

    </div>
  );
}
