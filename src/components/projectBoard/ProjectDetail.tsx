import { useMemo, useState } from 'react';
import { Clock, ListChecks, Users2, Plus, Eye, CalendarClock, Pencil, Trash2, X } from 'lucide-react';
import { Employee, Meeting } from '../../types';
import { ProjectRow, ProjectTaskItem, ProjectTaskStatus } from './types';
import { STATUS_DOT, TASK_STATUS_LABEL, TASK_STATUS_COLOR, PROJECT_PRIORITY_META } from './statusMeta';
import { getAvatarColor } from '../../lib/avatarColor';
import { displayName, PRIORITY_OPTIONS } from './CreateProjectModal';
import Dropdown from '../Dropdown';
import AddTaskModal from './AddTaskModal';
import EditProjectModal from './EditProjectModal';
import ProjectGantt from './ProjectGantt';
import TaskDetailModal from './TaskDetailModal';
import { ForkRow } from '../OrgChart';

// Two-step inline confirm (click once to arm, click again to confirm) — same idea as OrgChart's
// own DeleteButton, just laid out inline for a table cell instead of pinned to a card corner.
function InlineDeleteConfirm({ onConfirm, label }: { onConfirm: () => void; label: string }) {
  const [armed, setArmed] = useState(false);
  if (armed) {
    return (
      <span className="inline-flex items-center gap-1">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onConfirm(); setArmed(false); }}
          className="text-[10px] font-bold text-red-600 hover:text-red-800 cursor-pointer"
        >
          {label}?
        </button>
        <button type="button" onClick={(e) => { e.stopPropagation(); setArmed(false); }} className="text-slate-400 hover:text-slate-600 cursor-pointer">
          <X size={12} />
        </button>
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); setArmed(true); }}
      title={label}
      className="text-[#A0A0A0] hover:text-red-600 cursor-pointer transition-colors"
    >
      <Trash2 size={14} />
    </button>
  );
}

type DetailTab = 'overview' | 'tasks' | 'team' | 'meetings' | 'timeline';
type TaskFilter = 'all' | ProjectTaskStatus;

const TABS: { value: DetailTab; label: string }[] = [
  { value: 'overview', label: 'ภาพรวม' },
  { value: 'tasks', label: 'งาน' },
  { value: 'team', label: 'ทีม' },
  { value: 'meetings', label: 'การประชุม' },
  { value: 'timeline', label: 'Timeline' },
];

const TASK_FILTER_OPTIONS: { value: TaskFilter; label: string }[] = [
  { value: 'all', label: 'ทุกสถานะ' },
  { value: 'todo', label: TASK_STATUS_LABEL.todo },
  { value: 'in_progress', label: TASK_STATUS_LABEL.in_progress },
  { value: 'review', label: TASK_STATUS_LABEL.review },
  { value: 'blocked', label: TASK_STATUS_LABEL.blocked },
  { value: 'done', label: TASK_STATUS_LABEL.done },
];

function formatBudget(budget: number | null): string {
  if (budget === null) return 'ยังไม่มี';
  return `฿${budget.toLocaleString('th-TH')}`;
}

function EmployeeAvatar({ name, sizePx = 32 }: { name: string; sizePx?: number }) {
  return (
    <div
      className="rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
      style={{ backgroundColor: getAvatarColor(name), width: sizePx, height: sizePx }}
    >
      {name.trim().charAt(0).toUpperCase()}
    </div>
  );
}

interface ProjectDetailProps {
  row: ProjectRow;
  tasks: ProjectTaskItem[];
  meetings: Meeting[];
  employees: Employee[];
  currentUserId: string;
  onAddTask: (task: Omit<ProjectTaskItem, 'id'>) => Promise<ProjectTaskItem>;
  onUpdateTask: (id: string, updates: Partial<ProjectTaskItem>) => Promise<void>;
  onDeleteTask: (id: string) => Promise<void>;
  onAddMeeting: (meeting: Omit<Meeting, 'id'>) => Promise<void>;
  onCreateFolder: (name: string, parentId?: string | null, taskId?: string) => string;
  onUpdateProject: (updates: Partial<ProjectRow>) => Promise<void>;
  existingProjectTitles: string[];
}

export default function ProjectDetail({ row, tasks, meetings, employees, currentUserId, onAddTask, onUpdateTask, onDeleteTask, onAddMeeting, onCreateFolder, onUpdateProject, existingProjectTitles }: ProjectDetailProps) {
  const [tab, setTab] = useState<DetailTab>('overview');
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ProjectTaskItem | null>(null);
  const [isEditProjectOpen, setIsEditProjectOpen] = useState(false);
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('all');
  const [selectedTask, setSelectedTask] = useState<ProjectTaskItem | null>(null);

  const openAddTask = () => { setEditingTask(null); setIsAddTaskOpen(true); };
  const openEditTask = (task: ProjectTaskItem) => { setEditingTask(task); setIsAddTaskOpen(true); };
  const closeTaskModal = () => { setIsAddTaskOpen(false); setEditingTask(null); };

  const counts = useMemo(() => {
    const base = { total: tasks.length, done: 0, in_progress: 0, review: 0, blocked: 0 };
    tasks.forEach((t) => {
      if (t.status === 'done') base.done += 1;
      else if (t.status === 'in_progress') base.in_progress += 1;
      else if (t.status === 'review') base.review += 1;
      else if (t.status === 'blocked') base.blocked += 1;
    });
    return base;
  }, [tasks]);

  const overallProgress = tasks.length > 0
    ? Math.round(tasks.reduce((sum, t) => sum + t.progress, 0) / tasks.length)
    : row.progress ?? 0;

  const employeeById = useMemo(() => {
    const map = new Map<string, Employee>();
    employees.forEach((e) => map.set(e.id, e));
    return map;
  }, [employees]);

  const projectMeetings = useMemo(
    () => meetings
      .filter((m) => m.projectId === row.id)
      .sort((a, b) => `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`)),
    [meetings, row.id]
  );

  // The status filter next to the tab bar applies to whichever list/chart the current tab shows
  // (overview's table, งาน's "only my tasks", ทีม's per-member task lists, and the Gantt chart) —
  // it does not affect the progress overview card above, which always reflects the whole project.
  const filteredTasks = useMemo(
    () => (taskFilter === 'all' ? tasks : tasks.filter((t) => t.status === taskFilter)),
    [tasks, taskFilter]
  );

  const myTasks = useMemo(
    () => filteredTasks.filter((t) => t.assigneeEmployeeIds.includes(currentUserId)),
    [filteredTasks, currentUserId]
  );

  const teamMembers = useMemo(() => {
    // "ผู้รับผิดชอบร่วม" (row.memberEmployeeIds) are project-level members declared up front at
    // create/edit time — they belong in this list even with zero tasks assigned yet, not just
    // whoever happens to already have a task (which used to be the only way anyone showed up here).
    const explicitMemberIds = row.memberEmployeeIds ?? [];
    const taskAssigneeIds = filteredTasks.flatMap((t) => t.assigneeEmployeeIds);
    const ids = Array.from(new Set([...explicitMemberIds, ...taskAssigneeIds]));
    return ids
      .map((id) => {
        const member = employeeById.get(id);
        if (!member) return null;
        const memberTasks = filteredTasks.filter((t) => t.assigneeEmployeeIds.includes(id));
        return { member, tasks: memberTasks };
      })
      .filter((entry): entry is { member: Employee; tasks: ProjectTaskItem[] } => Boolean(entry))
      // "เรียงตามตำแหน่งสำคัญของโปรเจกต์" — no explicit seniority field exists per project, so task
      // count (how much of this project someone is actually carrying) stands in as the ranking.
      .sort((a, b) => b.tasks.length - a.tasks.length);
  }, [filteredTasks, employeeById, row.memberEmployeeIds]);

  const ownerEmployee = row.ownerEmployeeId ? employeeById.get(row.ownerEmployeeId) : undefined;

  // If the project's ผู้รับผิดชอบหลัก turns out to be one of the task assignees already listed
  // below, show them once at the top (with their real tasks) instead of twice.
  const ownerMatch = ownerEmployee
    ? teamMembers.find(({ member }) => member.id === ownerEmployee.id)
    : undefined;
  const childMembers = ownerMatch ? teamMembers.filter((t) => t.member.id !== ownerMatch.member.id) : teamMembers;

  return (
    <div className="space-y-5">
      {/* Title/status/code used to repeat here — now shown once, up in the Header's breadcrumb
          (see AppLayout.tsx's selectedProject branch), so this row is just the page action. */}
      <div className="flex justify-end gap-2.5">
        <button
          type="button"
          onClick={() => setIsEditProjectOpen(true)}
          className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 text-[#272220] text-sm font-bold px-4 h-10 rounded-xl border border-[#E5E5E5] cursor-pointer transition-colors shrink-0"
        >
          <Pencil size={15} />
          แก้ไขโครงการ
        </button>
        <button
          type="button"
          onClick={openAddTask}
          className="inline-flex items-center gap-1.5 bg-[#FF6537] hover:bg-[#e6572c] text-white text-sm font-bold px-4 h-10 rounded-xl cursor-pointer transition-colors shrink-0"
        >
          <Plus size={16} />
          เพิ่มงาน/นัดประชุม
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-[0px_2px_7px_-1px_rgba(0,0,0,0.1)] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-[#272220]">ความคืบหน้าโครงการ</h3>
          <span className="text-2xl font-bold" style={{ color: STATUS_DOT[row.status] }}>{overallProgress}%</span>
        </div>
        <div className="h-2.5 rounded-full bg-[#F0F0F0] overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${overallProgress}%`, backgroundColor: STATUS_DOT[row.status] }} />
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[#6F6F6F]">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-300" />ทั้งหมด {counts.total}</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: TASK_STATUS_COLOR.done }} />เสร็จแล้ว {counts.done}</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: TASK_STATUS_COLOR.in_progress }} />กำลังทำ {counts.in_progress}</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: TASK_STATUS_COLOR.review }} />รอตรวจ {counts.review}</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: TASK_STATUS_COLOR.blocked }} />ติดปัญหา {counts.blocked}</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 pt-3 border-t border-slate-50 text-xs">
          <div>
            <p className="text-[#A0A0A0] mb-1">ผู้รับผิดชอบหลัก</p>
            {ownerEmployee ? (
              <span className="flex items-center gap-1.5 font-medium text-[#272220]">
                {ownerEmployee.avatar ? (
                  <img src={ownerEmployee.avatar} alt="" className="w-5 h-5 rounded-full object-cover shrink-0" />
                ) : (
                  <EmployeeAvatar name={displayName(ownerEmployee)} sizePx={20} />
                )}
                {displayName(ownerEmployee)}
              </span>
            ) : <span className="text-[#272220]">ยังไม่มี</span>}
          </div>
          <div>
            <p className="text-[#A0A0A0] mb-1">ทีม</p>
            <p className="font-medium text-[#272220]">{row.department ?? 'ยังไม่มี'}</p>
          </div>
          <div>
            <p className="text-[#A0A0A0] mb-1">ความสำคัญ</p>
            {row.priority ? (
              <span className={`inline-block px-2 py-0.5 rounded-full font-medium ${PROJECT_PRIORITY_META[row.priority].className}`}>
                {PROJECT_PRIORITY_META[row.priority].label}
              </span>
            ) : <p className="font-medium text-[#272220]">ยังไม่มี</p>}
          </div>
          <div>
            <p className="text-[#A0A0A0] mb-1">วันที่เริ่ม</p>
            <p className="font-medium text-[#272220]">{row.startDate ?? 'ยังไม่มี'}</p>
          </div>
          <div>
            <p className="text-[#A0A0A0] mb-1">กำหนดส่ง</p>
            <p className="font-medium text-[#272220]">{row.endDate ?? 'ยังไม่มี'}</p>
          </div>
          <div>
            <p className="text-[#A0A0A0] mb-1">งบประมาณ</p>
            <p className="font-medium text-[#272220]">{formatBudget(row.budget)}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-b border-slate-200">
        <div className="flex items-center gap-6">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTab(t.value)}
              className={`relative pb-3 text-sm font-semibold cursor-pointer transition-colors ${
                tab === t.value ? 'text-[#FF6537]' : 'text-[#6F6F6F] hover:text-[#272220]'
              }`}
            >
              {t.label}
              {tab === t.value && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-[#FF6537] rounded-full" />}
            </button>
          ))}
        </div>

        <div className="w-36 pb-2 shrink-0">
          <Dropdown<TaskFilter>
            value={taskFilter}
            onChange={setTaskFilter}
            options={TASK_FILTER_OPTIONS}
          />
        </div>
      </div>

      {tab === 'overview' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-[0px_2px_7px_-1px_rgba(0,0,0,0.1)] overflow-hidden">
          <h4 className="font-bold text-[#272220] px-5 pt-5 pb-3">งานทั้งหมดของโครงการ</h4>
          {filteredTasks.length === 0 ? (
            <p className="text-sm text-[#A0A0A0] px-5 pb-5">ไม่มีงานที่ตรงกับตัวกรอง</p>
          ) : (
            <div className="overflow-x-auto">
              {/* table-fixed + explicit column widths — without them, the browser was handing
                  every last pixel of unused space to "ชื่องาน" while the other 3 columns got
                  squeezed together at the far right instead of spreading out evenly. */}
              <table className="w-full text-sm border-collapse table-fixed">
                <thead>
                  <tr className="bg-[#F9F9F9] text-[12px] font-semibold text-[#000000] border-b border-[#EDEEEF]">
                    <th className="px-5 py-2 w-[28%]">ชื่องาน</th>
                    <th className="px-5 py-2 w-[22%]">รายละเอียด</th>
                    <th className="px-5 py-2 w-[15%]">ผู้รับผิดชอบ</th>
                    <th className="px-5 py-2 w-[13%]">วันที่</th>
                    <th className="px-5 py-2 w-[12%]">สถานะ</th>
                    <th className="px-5 py-2 w-[10%]">การกระทำ</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTasks.map((t) => {
                    const taskAssignees = t.assigneeEmployeeIds.map((id) => employeeById.get(id)).filter((e): e is Employee => Boolean(e));
                    const assigneeLabel = taskAssignees.length > 0
                      ? `${displayName(taskAssignees[0])}${taskAssignees.length > 1 ? ` +${taskAssignees.length - 1}` : ''}`
                      : 'ยังไม่มี';
                    return (
                      <tr key={t.id} className="border-b border-[#EDEEEF] last:border-b-0 hover:bg-slate-50">
                        <td className="px-5 py-3 font-medium text-[#272220]">
                          <span className="flex items-center gap-2 min-w-0">
                            <ListChecks size={14} className="text-[#A0A0A0] shrink-0" />
                            <span className="truncate">{t.title}</span>
                          </span>
                        </td>
                        <td className="px-5 py-3 text-[#6F6F6F] truncate" title={t.description}>{t.description || 'ยังไม่มี'}</td>
                        <td className="px-5 py-3 text-[#6F6F6F] whitespace-nowrap">{assigneeLabel}</td>
                        <td className="px-5 py-3 text-[#6F6F6F] whitespace-nowrap">{t.dueDate ?? 'ยังไม่มีกำหนด'}</td>
                        <td className="px-5 py-3 whitespace-nowrap">
                          <span
                            className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: `${TASK_STATUS_COLOR[t.status]}1A`, color: TASK_STATUS_COLOR[t.status] }}
                          >
                            {TASK_STATUS_LABEL[t.status]}
                          </span>
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2.5">
                            <button
                              type="button"
                              onClick={() => setSelectedTask(t)}
                              title="ดูรายละเอียด"
                              className="text-[#A0A0A0] hover:text-[#FF6537] cursor-pointer transition-colors"
                            >
                              <Eye size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditTask(t)}
                              title="แก้ไข"
                              className="text-[#A0A0A0] hover:text-[#FF6537] cursor-pointer transition-colors"
                            >
                              <Pencil size={13} />
                            </button>
                            <InlineDeleteConfirm label="ลบ" onConfirm={() => onDeleteTask(t.id)} />
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
      )}

      {tab === 'tasks' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-[0px_2px_7px_-1px_rgba(0,0,0,0.1)] overflow-hidden">
          {myTasks.length === 0 ? (
            <div className="p-10 text-center text-sm text-[#A0A0A0]">
              {taskFilter === 'all' ? 'ยังไม่มีงานที่คุณรับผิดชอบในโครงการนี้' : 'ไม่มีงานที่ตรงกับตัวกรอง'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-[#F9F9F9] text-[12px] font-semibold text-[#000000] border-b border-[#EDEEEF]">
                    <th className="px-5 py-3">สถานะ</th>
                    <th className="px-5 py-3">ชื่องาน</th>
                    <th className="px-5 py-3">ระยะเวลา</th>
                    <th className="px-5 py-3">ความคืบหน้า</th>
                    <th className="px-5 py-3">ความสำคัญ</th>
                    <th className="px-5 py-3">การกระทำ</th>
                  </tr>
                </thead>
                <tbody>
                  {myTasks.map((t) => {
                    const isUrgent = t.daysUntilDue !== undefined && t.daysUntilDue <= 2;
                    const creator = t.creatorEmployeeId ? employeeById.get(t.creatorEmployeeId) : undefined;
                    const priorityMeta = t.priority ? PRIORITY_OPTIONS.find((p) => p.value === t.priority) : undefined;
                    return (
                      <tr key={t.id} className="border-b border-[#EDEEEF] last:border-b-0 hover:bg-slate-50 align-top">
                        <td className="px-5 py-3 whitespace-nowrap">
                          <div className="flex flex-col gap-1 items-start">
                            <span
                              className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                              style={{ backgroundColor: `${TASK_STATUS_COLOR[t.status]}1A`, color: TASK_STATUS_COLOR[t.status] }}
                            >
                              {TASK_STATUS_LABEL[t.status]}
                            </span>
                            {isUrgent && (
                              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-red-50 text-[#F50C0C] flex items-center gap-1">
                                <Clock size={11} />
                                {t.daysUntilDue! < 0 ? 'เลยกำหนดแล้ว' : `เหลือ ${t.daysUntilDue} วัน`}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3 font-medium text-[#272220] max-w-70">
                          {t.title}
                          {t.description && <p className="text-[11px] font-normal text-[#6F6F6F] mt-0.5 truncate" title={t.description}>{t.description}</p>}
                          {creator && <p className="text-[11px] font-normal text-[#A0A0A0] mt-0.5">สร้างโดย: {displayName(creator)}</p>}
                        </td>
                        <td className="px-5 py-3 text-[#6F6F6F] whitespace-nowrap">
                          {t.startDate ? `${t.startDate} — ${t.dueDate ?? 'ยังไม่มี'}` : t.dueDate ?? 'ยังไม่มี'}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2 min-w-[120px]">
                            <div className="flex-1 h-1.5 rounded-full bg-[#F0F0F0] overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${t.progress}%`, backgroundColor: TASK_STATUS_COLOR[t.status] }} />
                            </div>
                            <span className="text-xs font-medium shrink-0" style={{ color: TASK_STATUS_COLOR[t.status] }}>{t.progress}%</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap">
                          {priorityMeta ? (
                            <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-medium border ${priorityMeta.activeClass}`}>
                              {priorityMeta.label}
                            </span>
                          ) : (
                            <span className="text-[#6F6F6F]">ยังไม่มี</span>
                          )}
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => setSelectedTask(t)}
                              className="inline-flex items-center gap-1.5 text-[#A0A0A0] hover:text-[#FF6537] text-xs font-medium cursor-pointer transition-colors"
                            >
                              <Eye size={14} />
                              ดูรายละเอียด
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditTask(t)}
                              title="แก้ไข"
                              className="text-[#A0A0A0] hover:text-[#FF6537] cursor-pointer transition-colors"
                            >
                              <Pencil size={13} />
                            </button>
                            <InlineDeleteConfirm label="ลบ" onConfirm={() => onDeleteTask(t.id)} />
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
      )}

      {tab === 'team' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-[0px_2px_7px_-1px_rgba(0,0,0,0.1)] p-8 overflow-x-auto">
          <div className="flex flex-col items-center min-w-fit">
            {/* Lead node — always shown first regardless of the status filter, since it represents
                the project's ownership, not a filtered task. If the owner turns out to also be one
                of the task assignees below (ownerMatch), show their tasks here too. */}
            <div className="flex flex-col items-center gap-2 bg-white border-2 border-[#FF6537] rounded-2xl px-6 py-4 shadow-[0px_2px_7px_-1px_rgba(0,0,0,0.1)]">
              <span className="text-[10px] font-bold uppercase tracking-wide text-[#FF6537]">ผู้รับผิดชอบหลัก</span>
              {ownerMatch ? (
                <>
                  {ownerMatch.member.avatar ? (
                    <img src={ownerMatch.member.avatar} alt="" className="w-12 h-12 rounded-full object-cover shrink-0" />
                  ) : (
                    <EmployeeAvatar name={displayName(ownerMatch.member)} sizePx={48} />
                  )}
                  <div className="text-center">
                    <p className="font-bold text-[#272220] text-sm">{displayName(ownerMatch.member)}</p>
                    <p className="text-xs text-[#A0A0A0]">{ownerMatch.member.role}</p>
                  </div>
                  {ownerMatch.tasks.length > 0 && (
                    <div className="w-full pt-3 mt-1 border-t border-slate-50 space-y-2 text-left">
                      {ownerMatch.tasks.map((t) => (
                        <div key={t.id} className="flex items-start gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5" style={{ backgroundColor: TASK_STATUS_COLOR[t.status] }} />
                          <div className="min-w-0">
                            <p className="text-xs text-[#272220] truncate">{t.title}</p>
                            <p className="text-[10px] text-[#A0A0A0]">
                              เริ่ม {t.startDate ?? 'ยังไม่มี'} · ส่ง {t.dueDate ?? 'ยังไม่มี'}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : ownerEmployee ? (
                <>
                  {ownerEmployee.avatar ? (
                    <img src={ownerEmployee.avatar} alt="" className="w-12 h-12 rounded-full object-cover shrink-0" />
                  ) : (
                    <EmployeeAvatar name={displayName(ownerEmployee)} sizePx={48} />
                  )}
                  <div className="text-center">
                    <p className="font-bold text-[#272220] text-sm">{displayName(ownerEmployee)}</p>
                    <p className="text-xs text-[#A0A0A0]">{ownerEmployee.role}</p>
                  </div>
                </>
              ) : (
                <p className="text-sm text-[#A0A0A0] py-2">ยังไม่มีผู้รับผิดชอบหลัก</p>
              )}
            </div>

            {childMembers.length === 0 ? (
              <p className="text-sm text-[#A0A0A0] flex items-center gap-2 mt-6">
                <Users2 size={16} />
                {teamMembers.length > 0 ? 'สมาชิกที่เหลือคือผู้รับผิดชอบหลักด้านบนแล้ว' : taskFilter === 'all' ? 'ยังไม่มีสมาชิกในทีมของโครงการนี้' : 'ไม่มีสมาชิกที่มีงานตรงกับตัวกรอง'}
              </p>
            ) : (
              <>
                <div className="w-px h-6 bg-slate-300" />
                <ForkRow
                  items={childMembers}
                  keyOf={({ member }) => member.id}
                  gapPx={32}
                  renderItem={({ member, tasks: memberTasks }) => (
                    <div className="w-60 bg-white border border-slate-100 rounded-2xl shadow-[0px_2px_7px_-1px_rgba(0,0,0,0.1)] p-4 flex flex-col items-center gap-1">
                      {member.avatar ? (
                        <img src={member.avatar} alt="" className="w-11 h-11 rounded-full object-cover shrink-0" />
                      ) : (
                        <EmployeeAvatar name={member.nickname || member.name} sizePx={44} />
                      )}
                      <div className="text-center">
                        <p className="font-semibold text-[#272220] text-sm truncate max-w-52">{member.nickname || member.name}</p>
                        <p className="text-xs text-[#A0A0A0]">{member.role}</p>
                      </div>

                      <div className="w-full pt-3 mt-1 border-t border-slate-50 space-y-2">
                        {memberTasks.map((t) => (
                          <div key={t.id} className="flex items-start gap-1.5 text-left">
                            <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5" style={{ backgroundColor: TASK_STATUS_COLOR[t.status] }} />
                            <div className="min-w-0">
                              <p className="text-xs text-[#272220] truncate">{t.title}</p>
                              <p className="text-[10px] text-[#A0A0A0]">
                                เริ่ม {t.startDate ?? 'ยังไม่มี'} · ส่ง {t.dueDate ?? 'ยังไม่มี'}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                />
              </>
            )}
          </div>
        </div>
      )}

      {tab === 'meetings' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-[0px_2px_7px_-1px_rgba(0,0,0,0.1)] overflow-hidden">
          <h4 className="font-bold text-[#272220] px-5 pt-5 pb-3">การประชุมของโครงการ</h4>
          {projectMeetings.length === 0 ? (
            <p className="text-sm text-[#A0A0A0] px-5 pb-5">ยังไม่มีการนัดประชุมในโครงการนี้</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse table-fixed">
                <thead>
                  <tr className="bg-[#F9F9F9] text-[12px] font-semibold text-[#000000] border-b border-[#EDEEEF]">
                    <th className="px-5 py-2 w-[26%]">ชื่อการประชุม</th>
                    <th className="px-5 py-2 w-[24%]">รายละเอียด</th>
                    <th className="px-5 py-2 w-[20%]">วัน-เวลา</th>
                    <th className="px-5 py-2 w-[15%]">สถานที่</th>
                    <th className="px-5 py-2 w-[15%]">ผู้เข้าร่วม</th>
                  </tr>
                </thead>
                <tbody>
                  {projectMeetings.map((meeting) => {
                    const attendees = meeting.attendeeIds.map((id) => employeeById.get(id)).filter((e): e is Employee => Boolean(e));
                    return (
                      <tr key={meeting.id} className="border-b border-[#EDEEEF] last:border-b-0 hover:bg-slate-50 align-top">
                        <td className="px-5 py-3 font-medium text-[#272220]">
                          <span className="flex items-center gap-2 min-w-0">
                            <Users2 size={14} className="text-[#A0A0A0] shrink-0" />
                            <span className="truncate">{meeting.title}</span>
                          </span>
                        </td>
                        <td className="px-5 py-3 text-[#6F6F6F] truncate" title={meeting.description}>{meeting.description || 'ยังไม่มี'}</td>
                        <td className="px-5 py-3 text-[#6F6F6F] whitespace-nowrap">
                          <span className="flex items-center gap-1.5">
                            <CalendarClock size={13} className="shrink-0" />
                            {meeting.date} {meeting.startTime}{meeting.endTime ? ` - ${meeting.endTime}` : ''}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-[#6F6F6F] truncate" title={meeting.location}>{meeting.location || 'ยังไม่มี'}</td>
                        <td className="px-5 py-3 text-[#6F6F6F] truncate" title={attendees.map((e) => displayName(e)).join(', ')}>
                          {attendees.length > 0 ? attendees.map((e) => displayName(e)).join(', ') : 'ยังไม่มี'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'timeline' && <ProjectGantt tasks={filteredTasks} employees={employees} />}

      <AddTaskModal
        isOpen={isAddTaskOpen}
        onClose={closeTaskModal}
        onSave={onAddTask}
        onUpdateTask={onUpdateTask}
        onAddMeeting={onAddMeeting}
        onCreateFolder={onCreateFolder}
        projectId={row.id}
        projectDocFolderId={row.docFolderId}
        projectStartDate={row.startDateISO}
        projectEndDate={row.endDateISO}
        employees={employees}
        currentUserId={currentUserId}
        editingTask={editingTask}
      />

      <TaskDetailModal task={selectedTask} employees={employees} onClose={() => setSelectedTask(null)} />

      <EditProjectModal
        isOpen={isEditProjectOpen}
        onClose={() => setIsEditProjectOpen(false)}
        row={row}
        employees={employees}
        onSave={onUpdateProject}
        existingTitles={existingProjectTitles}
      />
    </div>
  );
}
