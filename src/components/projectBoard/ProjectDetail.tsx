import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Clock, ListChecks, Users2, Plus, Eye, CalendarClock, Pencil, Trash2, X, Maximize2, Minimize2, Ban, Send, ClipboardCheck, ChevronDown, ChevronRight, CornerDownRight } from 'lucide-react';
import { Employee, Meeting, LinkedDoc } from '../../types';
import { ProjectRow, ProjectTaskItem, ProjectTaskStatus, CustomProjectStatus, CustomProjectType } from './types';
import { STATUS_DOT, TASK_STATUS_LABEL, TASK_STATUS_COLOR, PROJECT_PRIORITY_META } from './statusMeta';
import { displayName, PRIORITY_OPTIONS, EmployeeMultiSelect } from './CreateProjectModal';
import { ChangeRequest } from '../../lib/api';
import { isOwner, resolveValidIds } from '../../lib/ownership';
import { isUrl } from '../../lib/url';
import EmployeeAvatar from '../EmployeeAvatar';
import Dropdown from '../Dropdown';
import Tooltip from '../Tooltip';
import AddTaskModal from './AddTaskModal';
import EditProjectModal from './EditProjectModal';
import AddResponsibleModal from './AddResponsibleModal';
import { useConfirm } from '../../context/ConfirmContext';
import ScheduleMeetingModal from './ScheduleMeetingModal';
import CancelMeetingModal from './CancelMeetingModal';
import SubmitTaskModal from './SubmitTaskModal';
import ReviewTaskModal from './ReviewTaskModal';
import ProjectGantt from './ProjectGantt';
import TaskDetailModal from './TaskDetailModal';
import { ForkRow } from '../OrgChart';
import PeopleCell from './PeopleCell';
import PendingRequestCard from './PendingRequestCard';
import DeleteRequestModal, { DeleteRequestTarget } from './DeleteRequestModal';

// Clamps long free-text to 3 lines with a "แสดงเพิ่มเติม"/"ย่อ" toggle — the toggle itself only
// renders when the text actually overflows 3 lines (measured via scrollHeight vs clientHeight
// right after mount), so a short description never gets a pointless toggle button under it.
function ExpandableText({ text, className }: { text: string; className?: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setIsOverflowing(el.scrollHeight > el.clientHeight + 1);
  }, [text]);

  return (
    <div>
      <p ref={ref} className={`${className ?? ''} ${isExpanded ? '' : 'line-clamp-3'}`}>
        {text}
      </p>
      {isOverflowing && (
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="text-xs font-semibold text-[#FF6537] hover:text-[#e6572c] cursor-pointer mt-2"
        >
          {isExpanded ? 'ย่อ' : 'แสดงเพิ่มเติม'}
        </button>
      )}
    </div>
  );
}

// Trash button for a table cell — clicking it opens the shared confirmation popup (useConfirm)
// before anything is deleted. `requiresReason` routes straight to a DeleteRequestModal (via `onRequestReason`) instead of the
// two-step arm/confirm — a modal already IS the confirmation step, and gives the reason field real
// room instead of a cramped inline input. `disabled` covers "a request is already pending for this
// row" so a second one can't be filed on top of it.
function InlineDeleteConfirm({ onConfirm, label, itemLabel, requiresReason, disabled, onRequestReason }: { onConfirm: (reason?: string) => void; label: string; itemLabel: string; requiresReason?: boolean; disabled?: boolean; onRequestReason?: () => void }) {
  const confirm = useConfirm();

  if (disabled) {
    return (
      <Tooltip content="มีคำขอรออนุมัติอยู่แล้ว">
        <span className="text-slate-300 cursor-not-allowed">
          <Trash2 size={14} />
        </span>
      </Tooltip>
    );
  }

  if (requiresReason) {
    return (
      <Tooltip content="ขอลบ (ต้องขออนุมัติ)">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRequestReason?.(); }}
          aria-label={label}
          className="text-[#A0A0A0] hover:text-red-600 cursor-pointer transition-colors"
        >
          <Trash2 size={14} />
        </button>
      </Tooltip>
    );
  }
  return (
    <Tooltip content={label}>
      <button
        type="button"
        onClick={async (e) => {
          e.stopPropagation();
          const confirmed = await confirm({
            title: 'ยืนยันการลบงาน?',
            message: `ลบ "${itemLabel}" ออกจากโครงการถาวร งานย่อย (ถ้ามี) จะถูกลบไปด้วย`,
            tone: 'danger',
          });
          if (confirmed) onConfirm();
        }}
        aria-label={label}
        className="text-[#A0A0A0] hover:text-red-600 cursor-pointer transition-colors"
      >
        <Trash2 size={14} />
      </button>
    </Tooltip>
  );
}

type DetailTab = 'overview' | 'tasks' | 'team' | 'meetings' | 'timeline';
type TaskFilter = 'all' | ProjectTaskStatus;

const TABS: { value: DetailTab; label: string }[] = [
  { value: 'overview', label: 'ภาพรวม' },
  { value: 'tasks', label: 'งาน' },
  { value: 'team', label: 'ทีม' },
  { value: 'meetings', label: 'การประชุม' },
  { value: 'timeline', label: 'Gantt' },
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
  onUpdateMeeting: (id: string, updates: Partial<Meeting>, reason?: string) => Promise<void>;
  onCreateFolder: (name: string, parentId: string | null, taskId: string | undefined, projectId: string) => Promise<string>;
  onUpdateProject: (updates: Partial<ProjectRow>) => Promise<void>;
  existingProjectTitles: string[];
  customStatuses: CustomProjectStatus[];
  customTypes: CustomProjectType[];
  changeRequests: ChangeRequest[];
  onRequestChange: (
    entityType: 'project' | 'project_task',
    entityId: string,
    requestType: 'edit' | 'delete',
    proposedChanges: Record<string, unknown> | undefined,
    reason: string
  ) => Promise<void>;
  onDecideChangeRequest: (requestId: string, decision: 'approve' | 'reject', note?: string) => Promise<void>;
  documents: LinkedDoc[];
  onAddDocument: (doc: Omit<LinkedDoc, 'id'>) => Promise<LinkedDoc>;
  orgSections: string[];
  // Every other project — for resolving/showing this one's โครงการหลัก/โครงการย่อย (see
  // parentProject/childProjects below) and for EditProjectModal's own "โครงการหลัก" picker.
  projects: ProjectRow[];
  onSelectProject: (id: string) => void;
  // ผู้บริหาร bypasses the owner-approval gate everywhere in this component — sees an "unowned"
  // experience (direct save/delete) regardless of whether they're actually an owner/assignee.
  isExecutive: boolean;
  // One-shot deep-link (e.g. from the Calendar page's meeting click) — which tab to open on first
  // mount instead of the usual "ภาพรวม" default. Any value outside DetailTab's own set is ignored.
  initialTab?: string | null;
}

const DETAIL_TABS: DetailTab[] = ['overview', 'tasks', 'team', 'meetings', 'timeline'];

export default function ProjectDetail({ row, tasks, meetings, employees, currentUserId, onAddTask, onUpdateTask, onDeleteTask, onAddMeeting, onUpdateMeeting, onCreateFolder, onUpdateProject, existingProjectTitles, customStatuses, customTypes, projects, onSelectProject, changeRequests, onRequestChange, onDecideChangeRequest, documents, onAddDocument, orgSections, isExecutive, initialTab }: ProjectDetailProps) {
  const [tab, setTab] = useState<DetailTab>(() => (
    initialTab && (DETAIL_TABS as string[]).includes(initialTab) ? (initialTab as DetailTab) : 'overview'
  ));
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ProjectTaskItem | null>(null);
  // งานย่อย — which task (if any) AddTaskModal is currently creating a new subtask under, and
  // which top-level tasks currently have their subtask rows expanded in the overview table.
  const [addingSubtaskFor, setAddingSubtaskFor] = useState<ProjectTaskItem | null>(null);
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set());
  const toggleTaskExpanded = (id: string) => setExpandedTaskIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const [isEditProjectOpen, setIsEditProjectOpen] = useState(false);
  // Quick "เพิ่มผู้รับผิดชอบ" shortcut — a small picker for both ผู้รับผิดชอบหลัก and ผู้รับผิดชอบร่วม
  // instead of sending someone through the full "แก้ไขโครงการ" form just to add people. Always shown;
  // the modal itself decides between saving directly and filing a change request.
  const [isAddOwnerOpen, setIsAddOwnerOpen] = useState(false);
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('all');
  const [selectedTask, setSelectedTask] = useState<ProjectTaskItem | null>(null);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [cancellingMeeting, setCancellingMeeting] = useState<Meeting | null>(null);
  // ส่งงาน/ตรวจงาน — the other half of the submit/review loop, previously only reachable from
  // MyWorkspace ("งานของฉัน"), so working a task from inside its own project meant leaving the
  // project entirely just to submit or review it.
  const [submittingTask, setSubmittingTask] = useState<ProjectTaskItem | null>(null);
  const [reviewingTask, setReviewingTask] = useState<ProjectTaskItem | null>(null);
  // A gated delete's required reason now comes from a proper modal instead of a cramped inline
  // text input squeezed into the table row — one shared instance for both task tables below.
  const [deleteReasonTarget, setDeleteReasonTarget] = useState<DeleteRequestTarget | null>(null);
  // "ขยาย" maximizes just the workspace (tabs row + the active tab's content) to fill the page's
  // own content area — the Sidebar and Header stay put, only this card grows into the space
  // beneath/beside them, sliding up to fill it and back down to its normal in-flow size. Escape
  // drops back, unless a modal on top is the one open.
  const [isWorkspaceExpanded, setIsWorkspaceExpanded] = useState(false);
  // `layout` only stays on for the brief moment the expand/collapse toggle itself is animating —
  // left on permanently, Framer Motion also spring-animates every ordinary height change this
  // element goes through (e.g. switching to a tab with a shorter/taller task table), which made
  // routine tab switches feel like they were bouncing/resizing instead of changing instantly.
  const [isAnimatingExpandToggle, setIsAnimatingExpandToggle] = useState(false);
  const toggleWorkspaceExpanded = () => {
    setIsAnimatingExpandToggle(true);
    setIsWorkspaceExpanded((prev) => !prev);
  };
  const isAnyModalOpen = isAddTaskOpen || isEditProjectOpen || isAddOwnerOpen || Boolean(selectedTask || editingMeeting || cancellingMeeting || submittingTask || reviewingTask || deleteReasonTarget);
  useEffect(() => {
    if (!isWorkspaceExpanded || isAnyModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setIsAnimatingExpandToggle(true); setIsWorkspaceExpanded(false); }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isWorkspaceExpanded, isAnyModalOpen]);

  // Measured against <main> itself (the one scrollable content area the Sidebar/Header shell
  // already carves out) rather than the viewport — <main>'s own box already excludes the Sidebar's
  // width (which varies: hidden on mobile, collapsed/expanded on desktop, user-toggled) and the
  // Header's height, so "expand" fills exactly the remaining workspace instead of covering them.
  // Re-measures on any resize of <main> itself (a ResizeObserver, not a window 'resize' listener,
  // since a Sidebar collapse toggle changes <main>'s box via flexbox with no window resize event).
  const [expandedRect, setExpandedRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  useLayoutEffect(() => {
    if (!isWorkspaceExpanded) {
      setExpandedRect(null);
      return;
    }
    const mainEl = document.querySelector('main');
    if (!mainEl) return;
    const update = () => {
      const rect = mainEl.getBoundingClientRect();
      setExpandedRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(mainEl);
    return () => observer.disconnect();
  }, [isWorkspaceExpanded]);

  const openAddTask = () => { setEditingTask(null); setAddingSubtaskFor(null); setIsAddTaskOpen(true); };
  const openEditTask = (task: ProjectTaskItem) => { setEditingTask(task); setAddingSubtaskFor(null); setIsAddTaskOpen(true); };
  const openAddSubtask = (parent: ProjectTaskItem) => { setEditingTask(null); setAddingSubtaskFor(parent); setIsAddTaskOpen(true); };
  const closeTaskModal = () => { setIsAddTaskOpen(false); setEditingTask(null); setAddingSubtaskFor(null); };

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

  // row.progress is computed once, centrally, in AppDataContext (เสร็จแล้ว ÷ ทั้งหมด across this
  // project's tasks) — the same number ProjectCard/ProjectTable/MyWorkspace all read now too, so
  // this card can't drift out of sync with them the way it used to.
  const overallProgress = row.progress ?? 0;

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

  // งานย่อย — the overview table groups subtasks directly under their parent task, nested to
  // any depth (a subtask can have its own subtasks, and so on) instead of listing every row
  // flat; ภาพรวม is the one place this hierarchy is worth showing — งาน/ทีม/Timeline still treat
  // every row (task or subtask, whatever its depth) as flat, matching how MyWorkspace and the
  // project's overall progress already do.
  const topLevelFilteredTasks = useMemo(() => filteredTasks.filter((t) => !t.parentTaskId), [filteredTasks]);
  const subtasksByParent = useMemo(() => {
    const map = new Map<string, ProjectTaskItem[]>();
    filteredTasks.forEach((t) => {
      if (!t.parentTaskId) return;
      const list = map.get(t.parentTaskId) ?? [];
      list.push(t);
      map.set(t.parentTaskId, list);
    });
    return map;
  }, [filteredTasks]);

  // Shared by ภาพรวม's table for a top-level task row and every level of its งานย่อย rows — a
  // subtask is otherwise rendered identically to a top-level task (same columns, same ส่งงาน/
  // ตรวจงาน/แก้ไข/ลบ actions, same ownership-gate exemption already baked into
  // InlineDeleteConfirm/AddTaskModal), so the only real differences here are indentation (scales
  // with depth) and the expand chevron. `depth` nests recursively — a subtask can have its own
  // subtasks, and so on, with no fixed limit — rendering itself plus, when expanded, every one of
  // its own children one level deeper.
  const renderOverviewTaskRow = (t: ProjectTaskItem, depth: number): React.ReactNode => {
    const taskAssignees = t.assigneeEmployeeIds.map((id) => employeeById.get(id)).filter((e): e is Employee => Boolean(e));
    const taskReviewers = (t.reviewerEmployeeIds ?? []).map((id) => employeeById.get(id)).filter((e): e is Employee => Boolean(e));
    const taskCreator = t.creatorEmployeeId ? employeeById.get(t.creatorEmployeeId) : undefined;
    const children = subtasksByParent.get(t.id) ?? [];
    const subtaskCount = children.length;
    const isSubtask = depth > 0;
    const isExpanded = expandedTaskIds.has(t.id);
    return (
      <Fragment key={t.id}>
      <tr className={`border-b border-[#EDEEEF] last:border-b-0 hover:bg-slate-50 ${isSubtask ? 'bg-slate-50/40' : ''}`}>
        <td className="px-5 py-3 font-medium text-[#272220] whitespace-nowrap">
          <span className="flex items-center gap-2 min-w-0" style={{ paddingLeft: depth * 24 }}>
            {subtaskCount > 0 ? (
              <button
                type="button"
                onClick={() => toggleTaskExpanded(t.id)}
                aria-label={isExpanded ? 'ย่องานย่อย' : 'ขยายงานย่อย'}
                className="text-[#A0A0A0] hover:text-[#FF6537] cursor-pointer shrink-0"
              >
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            ) : isSubtask ? (
              <CornerDownRight size={12} className="text-[#A0A0A0] shrink-0" />
            ) : (
              <span className="w-3.5 shrink-0" />
            )}
            <ListChecks size={14} className="text-[#A0A0A0] shrink-0" />
            <span>{t.title}</span>
            {subtaskCount > 0 && (
              <span className="text-[10px] font-medium text-[#A0A0A0] bg-slate-100 rounded-full px-1.5 py-0.5 shrink-0">{subtaskCount}</span>
            )}
          </span>
        </td>
        <td className="px-5 py-3 text-[#6F6F6F] max-w-50">
          <Tooltip content={t.description}><span className="block truncate">{t.description || 'ยังไม่มี'}</span></Tooltip>
        </td>
        <td className="px-5 py-3 whitespace-nowrap"><PeopleCell people={taskAssignees} /></td>
        <td className="px-5 py-3 whitespace-nowrap"><PeopleCell people={taskReviewers} /></td>
        <td className="px-5 py-3 whitespace-nowrap"><PeopleCell people={taskCreator ? [taskCreator] : []} /></td>
        <td className="px-5 py-3 text-[#6F6F6F] whitespace-nowrap">{t.startDate ?? 'ยังไม่มี'}</td>
        <td className="px-5 py-3 text-[#6F6F6F] whitespace-nowrap">{t.dueDate ?? 'ยังไม่มีกำหนด'}</td>
        <td className="px-5 py-3 whitespace-nowrap">
          <Tooltip content={t.status === 'blocked' ? t.blockedReason : undefined}>
            <span
              className="text-[11px] font-medium px-2 py-0.5 rounded-full"
              style={{ backgroundColor: `${TASK_STATUS_COLOR[t.status]}1A`, color: TASK_STATUS_COLOR[t.status] }}
            >
              {TASK_STATUS_LABEL[t.status]}
            </span>
          </Tooltip>
        </td>
        <td className="px-5 py-3 whitespace-nowrap">
          <div className="flex items-center gap-2.5">
            <Tooltip content="ดูรายละเอียด">
              <button
                type="button"
                onClick={() => setSelectedTask(t)}
                aria-label="ดูรายละเอียด"
                className="text-[#A0A0A0] hover:text-[#FF6537] cursor-pointer transition-colors"
              >
                <Eye size={14} />
              </button>
            </Tooltip>
            {/* "หัวข้อ" (any task with 1+ subtasks) is just a container — its own status is fully
                derived from its subtasks (see project-tasks.ts's recomputeAncestorStatuses), so
                there's nothing to genuinely "ส่งงาน"/"ตรวจงาน" on it directly; the real work lives
                on its subtasks instead. */}
            {subtaskCount === 0 && t.assigneeEmployeeIds.includes(currentUserId) && (t.status === 'todo' || t.status === 'in_progress' || t.status === 'blocked') && (
              <Tooltip content="ส่งงาน">
                <button
                  type="button"
                  onClick={() => setSubmittingTask(t)}
                  aria-label="ส่งงาน"
                  className="text-[#A0A0A0] hover:text-[#FF6537] cursor-pointer transition-colors"
                >
                  <Send size={13} />
                </button>
              </Tooltip>
            )}
            {subtaskCount === 0 && (t.reviewerEmployeeIds ?? []).includes(currentUserId) && t.status === 'review' && (
              <Tooltip content="ตรวจงาน">
                <button
                  type="button"
                  onClick={() => setReviewingTask(t)}
                  aria-label="ตรวจงาน"
                  className="text-[#A0A0A0] hover:text-[#0EA5E9] cursor-pointer transition-colors"
                >
                  <ClipboardCheck size={13} />
                </button>
              </Tooltip>
            )}
            <Tooltip content="เพิ่มงานย่อย">
              <button
                type="button"
                onClick={() => openAddSubtask(t)}
                aria-label="เพิ่มงานย่อย"
                className="text-[#A0A0A0] hover:text-[#FF6537] cursor-pointer transition-colors"
              >
                <Plus size={13} />
              </button>
            </Tooltip>
            <Tooltip content="แก้ไข">
              <button
                type="button"
                onClick={() => openEditTask(t)}
                aria-label="แก้ไข"
                className="text-[#A0A0A0] hover:text-[#FF6537] cursor-pointer transition-colors"
              >
                <Pencil size={13} />
              </button>
            </Tooltip>
            <InlineDeleteConfirm
              label="ลบ"
              itemLabel={t.title}
              disabled={!t.parentTaskId && changeRequests.some((r) => r.entityType === 'project_task' && r.entityId === t.id && r.status === 'pending')}
              requiresReason={!isExecutive && !t.parentTaskId && !isOwner(resolveValidIds(t.assigneeEmployeeIds, employees), currentUserId)}
              onConfirm={() => onDeleteTask(t.id)}
              onRequestReason={() => setDeleteReasonTarget({
                label: 'ลบงาน',
                itemLabel: t.title,
                onConfirm: (reason) => onRequestChange('project_task', t.id, 'delete', undefined, reason),
              })}
            />
          </div>
        </td>
      </tr>
      {isExpanded && children.map((st) => renderOverviewTaskRow(st, depth + 1))}
      </Fragment>
    );
  };

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

  const owners = row.ownerEmployeeIds.map((id) => employeeById.get(id)).filter((e): e is Employee => Boolean(e));
  const projectMembers = (row.memberEmployeeIds ?? []).map((id) => employeeById.get(id)).filter((e): e is Employee => Boolean(e));
  const parentProject = row.parentProjectId ? projects.find((p) => p.id === row.parentProjectId) : undefined;
  const childProjects = projects.filter((p) => p.parentProjectId === row.id);

  // If any of the project's ผู้รับผิดชอบหลัก turn out to also be task assignees already listed
  // below, show them once at the top (with their real tasks) instead of twice.
  const ownerMatches = owners.map((owner) => ({
    owner,
    match: teamMembers.find(({ member }) => member.id === owner.id),
  }));
  const matchedOwnerIds = new Set(ownerMatches.filter((o) => o.match).map((o) => o.owner.id));
  const childMembers = teamMembers.filter((t) => !matchedOwnerIds.has(t.member.id));

  // Pending requests against this project itself or any of its tasks — surfaced here regardless
  // of which owner (project's or a task's) can actually decide each one (see canDecide per row).
  const pendingRequests = changeRequests.filter((r) => r.status === 'pending' && (
    (r.entityType === 'project' && r.entityId === row.id) ||
    (r.entityType === 'project_task' && tasks.some((t) => t.id === r.entityId))
  ));

  return (
    <div className="space-y-5">
      {/* Project name/status/code now live up in the shared Header (see AppLayout.tsx's
          selectedProject branch) so they stay visible even once this page's own toolbar/tabs
          scroll underneath it — this in-body heading just labels the workspace below it. */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-2xl font-bold text-[#272220] truncate">รายละเอียดโครงการ</h2>
        <div className="flex flex-wrap gap-2.5 w-full sm:w-auto sm:shrink-0">
          <button
            type="button"
            onClick={() => setIsAddOwnerOpen(true)}
            className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 text-[#272220] text-sm font-bold px-4 h-10 rounded-xl border border-[#E5E5E5] cursor-pointer transition-colors shrink-0"
          >
            <Users2 size={15} />
            เพิ่มผู้รับผิดชอบ
          </button>
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
            className="inline-flex items-center justify-center gap-1.5 bg-[#FF6537] hover:bg-[#e6572c] text-white text-sm font-bold px-4 h-10 rounded-xl cursor-pointer transition-colors shrink-0 max-sm:w-full"
          >
            <Plus size={16} />
            เพิ่มงาน/นัดประชุม
          </button>
        </div>
      </div>

      {/* Project description — was captured at create/edit time but never actually shown anywhere
          on this page until now. Same card treatment (white/rounded-2xl/border/shadow, per
          Design.md) as the progress card right below it, now that a long description with its
          own "แสดงเพิ่มเติม" toggle needs real breathing room instead of floating bare on the page. */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-[0px_2px_7px_-1px_rgba(0,0,0,0.1)] p-5">
        <ExpandableText text={row.description || 'ยังไม่มีรายละเอียดโครงการ'} className="text-sm text-[#6F6F6F] whitespace-pre-wrap" />
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

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4 pt-3 border-t border-slate-50 text-xs">
          <div>
            <p className="text-[#A0A0A0] mb-1">ผู้รับผิดชอบหลัก</p>
            <PeopleCell people={owners} />
          </div>
          <div>
            <p className="text-[#A0A0A0] mb-1">ผู้รับผิดชอบร่วม</p>
            {projectMembers.length > 0 ? <PeopleCell people={projectMembers} /> : <p className="font-medium text-[#272220]">ยังไม่มี</p>}
          </div>
          <div>
            <p className="text-[#A0A0A0] mb-1">แผนก</p>
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

        {(parentProject || childProjects.length > 0) && (
          <div className="flex flex-wrap items-start gap-x-6 gap-y-2 pt-3 border-t border-slate-50 text-xs">
            {parentProject && (
              <div>
                <p className="text-[#A0A0A0] mb-1">โครงการหลัก</p>
                <button
                  type="button"
                  onClick={() => onSelectProject(parentProject.id)}
                  className="font-medium text-[#FF6537] hover:underline cursor-pointer"
                >
                  {parentProject.title}
                </button>
              </div>
            )}
            {childProjects.length > 0 && (
              <div>
                <p className="text-[#A0A0A0] mb-1">โครงการย่อย ({childProjects.length})</p>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {childProjects.map((cp) => (
                    <button
                      key={cp.id}
                      type="button"
                      onClick={() => onSelectProject(cp.id)}
                      className="font-medium text-[#FF6537] hover:underline cursor-pointer"
                    >
                      {cp.title}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {pendingRequests.length > 0 && (
        <div className="bg-white rounded-2xl border border-amber-200 shadow-[0px_2px_7px_-1px_rgba(0,0,0,0.1)] p-5 space-y-3">
          <h3 className="font-bold text-[#272220]">คำขอที่รอดำเนินการ ({pendingRequests.length})</h3>
          {pendingRequests.map((request) => {
            const task = request.entityType === 'project_task' ? tasks.find((t) => t.id === request.entityId) : undefined;
            const entityTitle = request.entityType === 'project' ? row.title : task?.title ?? 'งาน';
            const ownerIds = resolveValidIds(request.entityType === 'project' ? row.ownerEmployeeIds : task?.assigneeEmployeeIds ?? [], employees);
            const requester = request.requestedBy ? employeeById.get(request.requestedBy) : undefined;
            return (
              <PendingRequestCard
                key={request.id}
                request={request}
                entityTitle={entityTitle}
                requesterLabel={requester ? displayName(requester) : 'ไม่ทราบผู้ใช้งาน'}
                canDecide={isOwner(ownerIds, currentUserId) && ownerIds.length > 0}
                onDecide={(decision, note) => onDecideChangeRequest(request.id, decision, note)}
              />
            );
          })}
        </div>
      )}

      <motion.div
        layout={isAnimatingExpandToggle}
        onLayoutAnimationComplete={() => setIsAnimatingExpandToggle(false)}
        transition={{ type: 'spring', stiffness: 320, damping: 32, mass: 0.9 }}
        style={isWorkspaceExpanded && expandedRect ? {
          position: 'fixed',
          top: expandedRect.top,
          left: expandedRect.left,
          width: expandedRect.width,
          height: expandedRect.height,
          zIndex: 30,
        } : undefined}
        className={isWorkspaceExpanded ? 'bg-[#F6F6F6] overflow-y-auto p-4 sm:p-6 space-y-4' : 'space-y-5'}
      >
      {/* Sticky under the shared Header, same offset trick as every other module's own
          toolbar/filter row — otherwise this tabs+filter row scrolls away with the task list
          underneath it instead of staying put like ProjectBoard/DocVault/etc. already do. */}
      <div className="sticky -top-4 sm:-top-6 lg:-top-3.75 z-30 bg-[#F6F6F6] pt-1">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="shrink-0 flex items-center gap-0.5 bg-white border border-slate-200 rounded-xl p-1 w-fit max-w-full overflow-x-auto scrollbar-none">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTab(t.value)}
              className={`px-3.5 h-8 rounded-lg text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                tab === t.value ? 'bg-[#FF6537] text-white' : 'text-[#6F6F6F] hover:text-[#272220]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Expanding the workspace covers the page header (and its own "เพิ่มงาน/นัดประชุม"
              button) behind this fixed-position overlay — this is the same action reachable from
              this toolbar instead, so it doesn't just disappear once expanded. */}
          {isWorkspaceExpanded && (
            <button
              type="button"
              onClick={openAddTask}
              className="inline-flex items-center gap-1.5 bg-[#FF6537] hover:bg-[#e6572c] text-white text-xs font-bold px-3 h-10 rounded-xl cursor-pointer transition-colors shrink-0"
            >
              <Plus size={15} />
              เพิ่มงาน/นัดประชุม
            </button>
          )}
          <Tooltip content={isWorkspaceExpanded ? 'ย่อพื้นที่ทำงาน (Esc)' : 'ขยายพื้นที่ทำงาน'} placement="bottom">
            <button
              type="button"
              onClick={toggleWorkspaceExpanded}
              className="w-10 h-10 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-[#6F6F6F] hover:text-[#FF6537] hover:border-[#FF6537] cursor-pointer transition-colors shrink-0"
            >
              {isWorkspaceExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          </Tooltip>
          <div className="w-36 shrink-0">
            <Dropdown<TaskFilter>
              value={taskFilter}
              onChange={setTaskFilter}
              options={TASK_FILTER_OPTIONS}
            />
          </div>
        </div>
      </div>
      </div>

      {tab === 'overview' && (
        <>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-[0px_2px_7px_-1px_rgba(0,0,0,0.1)] overflow-hidden">
          <h4 className="font-bold text-[#272220] px-5 pt-5 pb-3">งานทั้งหมดของโครงการ</h4>
          {filteredTasks.length === 0 ? (
            <p className="text-sm text-[#A0A0A0] px-5 pb-5">ไม่มีงานที่ตรงกับตัวกรอง</p>
          ) : (
            <div className="overflow-x-auto">
              {/* No table-fixed / percentage widths here on purpose — every column takes its
                  natural width (so ผู้รับผิดชอบ/ผู้ตรวจ/dates never get squeezed) except
                  รายละเอียด, which is the one column capped with a max-width + ellipsis, since
                  it's the only field with genuinely unbounded free-text length. */}
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-[#F9F9F9] text-[12px] font-semibold text-[#000000] border-b border-[#EDEEEF]">
                    <th className="px-5 py-2 text-left whitespace-nowrap">ชื่องาน</th>
                    <th className="px-5 py-2 text-left">รายละเอียด</th>
                    <th className="px-5 py-2 text-left whitespace-nowrap">ผู้รับผิดชอบ</th>
                    <th className="px-5 py-2 text-left whitespace-nowrap">ผู้ตรวจ</th>
                    <th className="px-5 py-2 text-left whitespace-nowrap">ผู้สร้าง</th>
                    <th className="px-5 py-2 text-left whitespace-nowrap">วันที่เริ่ม</th>
                    <th className="px-5 py-2 text-left whitespace-nowrap">กำหนดส่ง</th>
                    <th className="px-5 py-2 text-left whitespace-nowrap">สถานะ</th>
                    <th className="px-5 py-2 text-left whitespace-nowrap">การกระทำ</th>
                  </tr>
                </thead>
                <tbody>
                  {topLevelFilteredTasks.map((t) => renderOverviewTaskRow(t, 0))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Meetings shown alongside tasks here too — ภาพรวม is meant to be the one tab that
            covers everything happening in the project, not just its task list. Kept to a compact
            row-per-meeting list (rather than duplicating the การประชุม tab's full table with its
            edit/cancel actions) since this tab's job is a quick summary; clicking a row jumps
            straight to the full table for anyone who wants to act on it. */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-[0px_2px_7px_-1px_rgba(0,0,0,0.1)] overflow-hidden">
          <h4 className="font-bold text-[#272220] px-5 pt-5 pb-3">การประชุมของโครงการ</h4>
          {projectMeetings.length === 0 ? (
            <p className="text-sm text-[#A0A0A0] px-5 pb-5">ยังไม่มีการนัดประชุมในโครงการนี้</p>
          ) : (
            <div className="divide-y divide-[#F4F4F4]">
              {projectMeetings.map((meeting) => {
                const isCancelled = meeting.status === 'cancelled';
                const linkedTask = meeting.taskId ? tasks.find((t) => t.id === meeting.taskId) : undefined;
                return (
                  <button
                    key={meeting.id}
                    type="button"
                    onClick={() => setTab('meetings')}
                    className={`w-full flex items-center justify-between gap-3 px-5 py-3 text-left hover:bg-slate-50 cursor-pointer ${isCancelled ? 'opacity-60' : ''}`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <Users2 size={14} className="text-[#A0A0A0] shrink-0" />
                      <span className={`truncate text-sm font-medium text-[#272220] ${isCancelled ? 'line-through' : ''}`}>{meeting.title}</span>
                      {linkedTask && (
                        <span className="shrink-0 text-[10px] font-medium text-[#6F6F6F] bg-slate-100 px-1.5 py-0.5 rounded-full truncate max-w-40">
                          งาน: {linkedTask.title}
                        </span>
                      )}
                    </span>
                    <span className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-[#6F6F6F] whitespace-nowrap flex items-center gap-1">
                        <CalendarClock size={12} />
                        {meeting.date} {meeting.startTime}
                      </span>
                      {isCancelled ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-[11px] font-medium">
                          <Ban size={11} /> ยกเลิกแล้ว
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-medium">
                          นัดหมายแล้ว
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        </>
      )}

      {tab === 'tasks' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-[0px_2px_7px_-1px_rgba(0,0,0,0.1)] overflow-hidden">
          {myTasks.length === 0 ? (
            <div className="p-10 text-center text-sm text-[#A0A0A0]">
              {taskFilter === 'all' ? 'ยังไม่มีงานที่คุณรับผิดชอบในโครงการนี้' : 'ไม่มีงานที่ตรงกับตัวกรอง'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-190 text-sm border-collapse">
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
                            <Tooltip content={t.status === 'blocked' ? t.blockedReason : undefined}>
                              <span
                                className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                                style={{ backgroundColor: `${TASK_STATUS_COLOR[t.status]}1A`, color: TASK_STATUS_COLOR[t.status] }}
                              >
                                {TASK_STATUS_LABEL[t.status]}
                              </span>
                            </Tooltip>
                            {isUrgent && (
                              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-red-50 text-[#F50C0C] flex items-center gap-1">
                                <Clock size={11} />
                                {t.daysUntilDue! < 0 ? 'เลยกำหนดแล้ว' : `เหลือ ${t.daysUntilDue} วัน`}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3 font-medium text-[#272220] min-w-52 max-w-70">
                          {t.title}
                          {t.description && <Tooltip content={t.description}><p className="text-[11px] font-normal text-[#6F6F6F] mt-0.5 truncate">{t.description}</p></Tooltip>}
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
                            {/* "หัวข้อ" (any task with 1+ subtasks) is a container, not real work —
                                its status is fully derived from its subtasks, so there's nothing
                                to "ส่งงาน" on it directly. */}
                            {(subtasksByParent.get(t.id) ?? []).length === 0 && (t.status === 'todo' || t.status === 'in_progress' || t.status === 'blocked') && (
                              <button
                                type="button"
                                onClick={() => setSubmittingTask(t)}
                                className="inline-flex items-center gap-1.5 text-[#FF6537] hover:text-[#e6572c] text-xs font-medium cursor-pointer transition-colors"
                              >
                                <Send size={13} />
                                ส่งงาน
                              </button>
                            )}
                            <Tooltip content="แก้ไข">
                              <button
                                type="button"
                                onClick={() => openEditTask(t)}
                                aria-label="แก้ไข"
                                className="text-[#A0A0A0] hover:text-[#FF6537] cursor-pointer transition-colors"
                              >
                                <Pencil size={13} />
                              </button>
                            </Tooltip>
                            <InlineDeleteConfirm
                              label="ลบ"
                              itemLabel={t.title}
                              disabled={!t.parentTaskId && changeRequests.some((r) => r.entityType === 'project_task' && r.entityId === t.id && r.status === 'pending')}
                              requiresReason={!isExecutive && !t.parentTaskId && !isOwner(resolveValidIds(t.assigneeEmployeeIds, employees), currentUserId)}
                              onConfirm={() => onDeleteTask(t.id)}
                              onRequestReason={() => setDeleteReasonTarget({
                                label: 'ลบงาน',
                                itemLabel: t.title,
                                onConfirm: (reason) => onRequestChange('project_task', t.id, 'delete', undefined, reason),
                              })}
                            />
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
            {/* Lead row — always shown first regardless of the status filter, since it represents
                the project's ownership, not a filtered task. Owners are peers with equal authority
                (not a hierarchy among themselves), so each gets its own box side by side rather
                than one box picking a single "the" owner. Any owner who's also a task assignee
                (ownerMatches) shows their real tasks inline instead of appearing twice below. */}
            {owners.length === 0 ? (
              <div className="flex flex-col items-center gap-2 bg-white border-2 border-[#FF6537] rounded-2xl px-6 py-4 shadow-[0px_2px_7px_-1px_rgba(0,0,0,0.1)]">
                <span className="text-[10px] font-bold uppercase tracking-wide text-[#FF6537]">ผู้รับผิดชอบหลัก</span>
                <p className="text-sm text-[#A0A0A0] py-2">ยังไม่มีผู้รับผิดชอบหลัก</p>
              </div>
            ) : (
              <div className="flex flex-wrap justify-center gap-4">
                {ownerMatches.map(({ owner, match }) => (
                  <div key={owner.id} className="flex flex-col items-center gap-2 bg-white border-2 border-[#FF6537] rounded-2xl px-6 py-4 shadow-[0px_2px_7px_-1px_rgba(0,0,0,0.1)] w-60">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-[#FF6537]">ผู้รับผิดชอบหลัก</span>
                    {owner.avatar ? (
                      <img src={owner.avatar} alt="" className="w-12 h-12 rounded-full object-cover shrink-0" />
                    ) : (
                      <EmployeeAvatar name={displayName(owner)} sizePx={48} />
                    )}
                    <div className="text-center">
                      <p className="font-bold text-[#272220] text-sm">{displayName(owner)}</p>
                      <p className="text-xs text-[#A0A0A0]">{owner.role}</p>
                    </div>
                    {match && match.tasks.length > 0 && (
                      <div className="w-full pt-3 mt-1 border-t border-slate-50 space-y-2 text-left">
                        {match.tasks.map((t) => (
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
                  </div>
                ))}
              </div>
            )}

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
                        {row.memberDuties?.[member.id] && (
                          <Tooltip content={row.memberDuties[member.id]}>
                            <p className="text-[11px] text-[#FF6537] mt-0.5 truncate max-w-52">
                              {row.memberDuties[member.id]}
                            </p>
                          </Tooltip>
                        )}
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
                    <th className="px-5 py-2 w-[22%]">ชื่อการประชุม</th>
                    <th className="px-5 py-2 w-[18%]">รายละเอียด</th>
                    <th className="px-5 py-2 w-[16%]">วัน-เวลา</th>
                    <th className="px-5 py-2 w-[12%]">สถานที่</th>
                    <th className="px-5 py-2 w-[12%]">ผู้เข้าร่วม</th>
                    <th className="px-5 py-2 w-[10%]">สถานะ</th>
                    <th className="px-5 py-2 w-[10%]">การกระทำ</th>
                  </tr>
                </thead>
                <tbody>
                  {projectMeetings.map((meeting) => {
                    const attendees = meeting.attendeeIds.map((id) => employeeById.get(id)).filter((e): e is Employee => Boolean(e));
                    const isCancelled = meeting.status === 'cancelled';
                    return (
                      <tr key={meeting.id} className={`border-b border-[#EDEEEF] last:border-b-0 hover:bg-slate-50 align-top ${isCancelled ? 'opacity-60' : ''}`}>
                        <td className="px-5 py-3 font-medium text-[#272220]">
                          <span className="flex items-center gap-2 min-w-0">
                            <Users2 size={14} className="text-[#A0A0A0] shrink-0" />
                            <span className={`truncate ${isCancelled ? 'line-through' : ''}`}>{meeting.title}</span>
                          </span>
                        </td>
                        <td className="px-5 py-3 text-[#6F6F6F] truncate"><Tooltip content={meeting.description}><span className="block truncate">{meeting.description || 'ยังไม่มี'}</span></Tooltip></td>
                        <td className="px-5 py-3 text-[#6F6F6F] whitespace-nowrap">
                          <span className="flex items-center gap-1.5">
                            <CalendarClock size={13} className="shrink-0" />
                            {meeting.date} {meeting.startTime}{meeting.endTime ? ` - ${meeting.endTime}` : ''}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-[#6F6F6F]">
                          {/* Pre-split meetings may still have a URL sitting in location alone —
                              still link-ify that legacy case instead of regressing to plain text. */}
                          {meeting.location && !meeting.meetingLink && isUrl(meeting.location) ? (
                            <a
                              href={meeting.location}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="block truncate text-[#FF6537] hover:underline"
                            >
                              {meeting.location}
                            </a>
                          ) : (
                            <Tooltip content={meeting.location}><span className="block truncate">{meeting.location || (meeting.meetingLink ? '' : 'ยังไม่มี')}</span></Tooltip>
                          )}
                          {meeting.locationLink && (
                            <a
                              href={meeting.locationLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="block truncate text-[#FF6537] hover:underline text-[11px] mt-0.5"
                            >
                              เปิดแผนที่
                            </a>
                          )}
                          {meeting.meetingLink && (
                            <a
                              href={meeting.meetingLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="block truncate text-[#FF6537] hover:underline text-[11px] mt-0.5"
                            >
                              {meeting.meetingLink}
                            </a>
                          )}
                        </td>
                        <td className="px-5 py-3 text-[#6F6F6F] truncate"><Tooltip content={attendees.map((e) => displayName(e)).join(', ')}><span className="block truncate">
                          {attendees.length > 0 ? attendees.map((e) => displayName(e)).join(', ') : 'ยังไม่มี'}
                        </span></Tooltip></td>
                        <td className="px-5 py-3 whitespace-nowrap">
                          {isCancelled ? (
                            <Tooltip content={meeting.cancellationReason ? `เหตุผล: ${meeting.cancellationReason}` : undefined}>
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-[11px] font-medium"
                              >
                                <Ban size={11} /> ยกเลิกแล้ว
                              </span>
                            </Tooltip>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-medium">
                              นัดหมายแล้ว
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap">
                          {!isCancelled && (
                            <div className="flex items-center gap-3">
                              <Tooltip content="แก้ไขสถานที่/ลิงก์">
                                <button
                                  type="button"
                                  onClick={() => setEditingMeeting(meeting)}
                                  aria-label="แก้ไขสถานที่/ลิงก์"
                                  className="text-[#A0A0A0] hover:text-[#FF6537] cursor-pointer transition-colors"
                                >
                                  <Pencil size={14} />
                                </button>
                              </Tooltip>
                              <Tooltip content="ยกเลิกประชุม">
                                <button
                                  type="button"
                                  onClick={() => setCancellingMeeting(meeting)}
                                  aria-label="ยกเลิกประชุม"
                                  className="text-[#A0A0A0] hover:text-red-600 cursor-pointer transition-colors"
                                >
                                  <Ban size={14} />
                                </button>
                              </Tooltip>
                            </div>
                          )}
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
      </motion.div>

      <AddTaskModal
        isOpen={isAddTaskOpen}
        onClose={closeTaskModal}
        onSave={onAddTask}
        onUpdateTask={onUpdateTask}
        onAddMeeting={onAddMeeting}
        onCreateFolder={onCreateFolder}
        documents={documents}
        onAddDocument={onAddDocument}
        currentUserName={employeeById.get(currentUserId) ? displayName(employeeById.get(currentUserId)!) : 'ผู้ใช้งานปัจจุบัน'}
        tasks={tasks}
        projectId={row.id}
        projectDocFolderId={row.docFolderId}
        projectStartDate={row.startDateISO}
        projectEndDate={row.endDateISO}
        projectMemberIds={[...row.ownerEmployeeIds, ...(row.memberEmployeeIds ?? [])]}
        employees={employees}
        currentUserId={currentUserId}
        isExecutive={isExecutive}
        editingTask={editingTask}
        parentTask={addingSubtaskFor}
        changeRequests={changeRequests}
        onRequestChange={onRequestChange}
      />

      <TaskDetailModal task={selectedTask} employees={employees} documents={documents} onClose={() => setSelectedTask(null)} />

      <SubmitTaskModal
        task={submittingTask}
        employees={employees}
        documents={documents}
        projectDocFolderId={row.docFolderId}
        projectMemberIds={[...row.ownerEmployeeIds, ...(row.memberEmployeeIds ?? [])]}
        currentUserId={currentUserId}
        currentUserName={employeeById.get(currentUserId) ? displayName(employeeById.get(currentUserId)!) : 'ผู้ใช้งานปัจจุบัน'}
        onAddDocument={onAddDocument}
        onSubmit={onUpdateTask}
        onClose={() => setSubmittingTask(null)}
      />

      <ReviewTaskModal
        task={reviewingTask}
        employees={employees}
        documents={documents}
        onReview={onUpdateTask}
        onClose={() => setReviewingTask(null)}
      />

      <DeleteRequestModal target={deleteReasonTarget} onClose={() => setDeleteReasonTarget(null)} />

      <EditProjectModal
        isOpen={isEditProjectOpen}
        onClose={() => setIsEditProjectOpen(false)}
        row={row}
        employees={employees}
        onSave={onUpdateProject}
        existingTitles={existingProjectTitles}
        customStatuses={customStatuses}
        customTypes={customTypes}
        projects={projects}
        currentUserId={currentUserId}
        isExecutive={isExecutive}
        changeRequests={changeRequests}
        onRequestChange={onRequestChange}
      />

      <AddResponsibleModal
        isOpen={isAddOwnerOpen}
        onClose={() => setIsAddOwnerOpen(false)}
        projectId={row.id}
        projectTitle={row.title}
        currentOwnerIds={row.ownerEmployeeIds}
        currentMemberIds={row.memberEmployeeIds ?? []}
        currentMemberDuties={row.memberDuties ?? {}}
        employees={employees}
        currentUserId={currentUserId}
        isExecutive={isExecutive}
        changeRequests={changeRequests}
        onSave={(updates) => onUpdateProject(updates)}
        onRequestChange={onRequestChange}
      />

      <ScheduleMeetingModal
        isOpen={Boolean(editingMeeting)}
        onClose={() => setEditingMeeting(null)}
        projects={[row]}
        employees={employees}
        currentUserId={currentUserId}
        onAddMeeting={onAddMeeting}
        meetingToEdit={editingMeeting}
        onUpdateMeeting={onUpdateMeeting}
        orgSections={orgSections}
      />

      <CancelMeetingModal
        meeting={cancellingMeeting}
        onClose={() => setCancellingMeeting(null)}
        onConfirm={onUpdateMeeting}
      />
    </div>
  );
}
