import { useMemo, useState } from 'react';
import {
  ListChecks,
  ClipboardCheck,
  Briefcase,
  GanttChartSquare,
  Eye,
  Send,
  Calendar as CalendarIcon,
  ShieldCheck,
} from 'lucide-react';
import { Employee, LinkedDoc } from '../types';
import { ProjectRow, ProjectTaskItem, ProjectTaskStatus } from './projectBoard/types';
import { TASK_STATUS_LABEL, TASK_STATUS_COLOR, STATUS_DOT, STATUS_LABEL, STATUS_PILL, STATUS_ICON } from './projectBoard/statusMeta';
import { displayName } from './projectBoard/CreateProjectModal';
import { getAvatarColor } from '../lib/avatarColor';
import { isOwner, isResponsibleForProject, resolveValidIds } from '../lib/ownership';
import { ChangeRequest } from '../lib/api';
import ProjectGantt from './projectBoard/ProjectGantt';
import TaskDetailModal from './projectBoard/TaskDetailModal';
import SubmitTaskModal from './projectBoard/SubmitTaskModal';
import ReviewTaskModal from './projectBoard/ReviewTaskModal';
import PendingRequestCard from './projectBoard/PendingRequestCard';
import Tooltip from './Tooltip';
import StatCard from './dashboard/StatCard';

type WorkTab = 'my_tasks' | 'to_review' | 'my_approvals' | 'my_projects' | 'gantt';

const TABS: { value: WorkTab; label: string; icon: typeof ListChecks }[] = [
  { value: 'my_tasks', label: 'งานของฉัน', icon: ListChecks },
  { value: 'to_review', label: 'งานที่ต้องตรวจ', icon: ClipboardCheck },
  { value: 'my_approvals', label: 'รออนุมัติจากฉัน', icon: ShieldCheck },
  { value: 'my_projects', label: 'โครงการของฉัน', icon: Briefcase },
  { value: 'gantt', label: 'Gantt ของฉัน', icon: GanttChartSquare },
];

function TaskStatusPill({ status, blockedReason }: { status: ProjectTaskStatus; blockedReason?: string }) {
  return (
    <Tooltip content={status === 'blocked' ? blockedReason : undefined}>
      <span
        className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium"
        style={{ backgroundColor: `${TASK_STATUS_COLOR[status]}1A`, color: TASK_STATUS_COLOR[status] }}
      >
        {TASK_STATUS_LABEL[status]}
      </span>
    </Tooltip>
  );
}

// Shows the first person + "+N" when there's more than one — a task can now have several
// assignees/reviewers, and a table cell doesn't have room to stack every avatar+name pair.
function PersonCell({ employees }: { employees: Employee[] }) {
  if (employees.length === 0) return <span className="text-[#6F6F6F]">ยังไม่มี</span>;
  const [first, ...rest] = employees;
  const name = displayName(first);
  return (
    <div className="flex items-center gap-2">
      {first.avatar ? (
        <img src={first.avatar} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
      ) : (
        <span
          className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0"
          style={{ backgroundColor: getAvatarColor(name) }}
        >
          {name.trim().charAt(0).toUpperCase()}
        </span>
      )}
      <span className="text-[#272220] truncate">{name}{rest.length > 0 ? ` +${rest.length}` : ''}</span>
    </div>
  );
}

interface MyWorkspaceProps {
  projectTasks: ProjectTaskItem[];
  projects: ProjectRow[];
  employees: Employee[];
  documents: LinkedDoc[];
  currentUserId: string;
  onUpdateTask: (id: string, updates: Partial<ProjectTaskItem>) => Promise<void>;
  onAddDocument: (doc: Omit<LinkedDoc, 'id'>) => Promise<LinkedDoc>;
  onSelectProject: (id: string) => void;
  changeRequests: ChangeRequest[];
  onDecideChangeRequest: (requestId: string, decision: 'approve' | 'reject', note?: string) => Promise<void>;
}

// "งานของฉัน" — replaces the old flat, org-wide Gantt browser (which read stale mock Task[] data
// disconnected from the real project/project_task tables) with a personal work hub: my tasks
// across every project, the tasks I've been asked to review, the projects I own or belong to, and
// a Gantt view scoped to just my own tasks. Submitting/reviewing a task is the other half of the
// loop — see SubmitTaskModal/ReviewTaskModal.
export default function MyWorkspace({ projectTasks, projects, employees, documents, currentUserId, onUpdateTask, onAddDocument, onSelectProject, changeRequests, onDecideChangeRequest }: MyWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<WorkTab>('my_tasks');
  const [viewingTask, setViewingTask] = useState<ProjectTaskItem | null>(null);
  const [submittingTask, setSubmittingTask] = useState<ProjectTaskItem | null>(null);
  const [reviewingTask, setReviewingTask] = useState<ProjectTaskItem | null>(null);

  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const employeeById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);

  // Restricts SubmitTaskModal's reviewer picker to people already on the task's own project.
  const submittingTaskProject = submittingTask ? projectById.get(submittingTask.projectId) : undefined;
  const submittingTaskProjectMemberIds = submittingTaskProject
    ? [...(submittingTaskProject.ownerEmployeeIds ?? []), ...(submittingTaskProject.memberEmployeeIds ?? [])]
    : undefined;

  const myTasks = useMemo(
    () => projectTasks.filter((t) => t.assigneeEmployeeIds.includes(currentUserId)),
    [projectTasks, currentUserId]
  );
  // "หัวข้อ" (any task with 1+ subtasks) is a container, not real work — its status is fully
  // derived from its subtasks (see project-tasks.ts's recomputeAncestorStatuses), so there's
  // nothing to genuinely "ส่งงาน" on it directly here either.
  const parentTaskIdsWithSubtasks = useMemo(
    () => new Set(projectTasks.filter((t) => t.parentTaskId).map((t) => t.parentTaskId as string)),
    [projectTasks]
  );
  const tasksToReview = useMemo(
    () => projectTasks.filter((t) => (t.reviewerEmployeeIds ?? []).includes(currentUserId) && t.status === 'review'),
    [projectTasks, currentUserId]
  );
  const myProjects = useMemo(
    () => projects.filter((p) => isResponsibleForProject(p, currentUserId)),
    [projects, currentUserId]
  );

  // Aggregates pending change requests across every project/task the current user can actually
  // decide on — the per-project panel on ProjectDetail only shows one project at a time, so anyone
  // with requests waiting on them in more than one place had no single list to check.
  const myApprovalRequests = useMemo(
    () => changeRequests.filter((r) => {
      if (r.status !== 'pending') return false;
      if (r.entityType === 'project') {
        const project = projects.find((p) => p.id === r.entityId);
        if (!project) return false;
        const validOwnerIds = resolveValidIds(project.ownerEmployeeIds, employees);
        return isOwner(validOwnerIds, currentUserId) && validOwnerIds.length > 0;
      }
      const task = projectTasks.find((t) => t.id === r.entityId);
      if (!task) return false;
      const validAssigneeIds = resolveValidIds(task.assigneeEmployeeIds, employees);
      return isOwner(validAssigneeIds, currentUserId) && validAssigneeIds.length > 0;
    }),
    [changeRequests, projects, projectTasks, currentUserId, employees]
  );

  const currentUser = employeeById.get(currentUserId);

  return (
    <div className="flex flex-col h-full min-h-0" id="my-workspace">
      <div className="shrink-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <StatCard
          icon={<ListChecks size={32} strokeWidth={2} />}
          iconColor="#FF6537"
          label="งานที่รับผิดชอบ"
          value={myTasks.length}
          detail="รวมทุกสถานะ"
        />
        <StatCard
          icon={<ClipboardCheck size={32} strokeWidth={2} />}
          iconColor="#0EA5E9"
          label="งานที่รอฉันตรวจ"
          value={tasksToReview.length}
          detail="สถานะรอตรวจอยู่ในขณะนี้"
        />
        <StatCard
          icon={<ShieldCheck size={32} strokeWidth={2} />}
          iconColor="#FFB03D"
          label="คำขอที่รอฉันอนุมัติ"
          value={myApprovalRequests.length}
          detail="คำขอแก้ไข/ลบที่รอการตัดสินใจ"
        />
        <StatCard
          icon={<Briefcase size={32} strokeWidth={2} />}
          iconColor="#0017C1"
          label="โครงการที่ดูแล"
          value={myProjects.length}
          detail="โครงการที่คุณรับผิดชอบหรือเป็นสมาชิก"
        />
      </div>

      <div className="shrink-0 flex items-center gap-0.5 bg-white border border-slate-200 rounded-xl p-1 w-fit max-w-full overflow-x-auto scrollbar-none mb-4">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              className={`flex items-center gap-1.5 px-3.5 h-8 rounded-lg text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                activeTab === tab.value ? 'bg-[#FF6537] text-white' : 'text-[#6F6F6F] hover:text-[#272220]'
              }`}
            >
              <Icon size={13} />
              {tab.label}
              {((tab.value === 'to_review' && tasksToReview.length > 0) || (tab.value === 'my_approvals' && myApprovalRequests.length > 0)) && (
                <span className="relative flex w-1.5 h-1.5 shrink-0">
                  <span className="absolute inline-flex w-full h-full rounded-full bg-[#F50C0C] opacity-75 animate-ping" />
                  <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-[#F50C0C]" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {activeTab === 'my_tasks' && (
          myTasks.length === 0 ? (
            <div className="bg-white border border-slate-100 rounded-2xl p-10 text-center text-slate-500 text-sm">
              ยังไม่มีงานที่คุณรับผิดชอบ
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-[0px_2px_7px_-1px_rgba(0,0,0,0.1)] overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-[#F9F9F9] text-[12px] font-semibold text-[#000000] border-b border-[#EDEEEF] whitespace-nowrap">
                    <th className="px-4 py-3">โครงการ</th>
                    <th className="px-4 py-3">ชื่องาน</th>
                    <th className="px-4 py-3">สถานะ</th>
                    <th className="px-4 py-3">กำหนดส่ง</th>
                    <th className="px-4 py-3">ผู้ตรวจ</th>
                    <th className="px-4 py-3">การกระทำ</th>
                  </tr>
                </thead>
                <tbody>
                  {myTasks.map((task) => {
                    const project = projectById.get(task.projectId);
                    const reviewers = employees.filter((e) => (task.reviewerEmployeeIds ?? []).includes(e.id));
                    const canSubmit = !parentTaskIdsWithSubtasks.has(task.id) && (task.status === 'todo' || task.status === 'in_progress' || task.status === 'blocked');
                    return (
                      <tr key={task.id} className="border-b border-[#EDEEEF] last:border-b-0 hover:bg-slate-50">
                        <td className="px-4 py-4 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => project && onSelectProject(project.id)}
                            className="text-[#FF6537] font-medium hover:underline cursor-pointer disabled:no-underline disabled:text-[#6F6F6F] disabled:cursor-default"
                            disabled={!project}
                          >
                            {project?.title ?? 'ไม่ทราบโครงการ'}
                          </button>
                        </td>
                        <td className="px-4 py-4 font-medium text-[#272220] max-w-60">
                          <p className="truncate">{task.title}</p>
                          {task.parentTaskId && (
                            <p className="text-[11px] font-normal text-[#6F6F6F] truncate mt-0.5">
                              งานย่อยของ: {projectTasks.find((t) => t.id === task.parentTaskId)?.title ?? 'ไม่ทราบงาน'}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <TaskStatusPill status={task.status} blockedReason={task.blockedReason} />
                          {task.status === 'in_progress' && task.reviewNote && (
                            <Tooltip content={task.reviewNote}>
                              <p className="text-[11px] text-red-600 mt-1 max-w-40 truncate">ตีกลับ: {task.reviewNote}</p>
                            </Tooltip>
                          )}
                        </td>
                        <td className="px-4 py-4 text-[#272220] whitespace-nowrap">{task.dueDate ?? 'ยังไม่มี'}</td>
                        <td className="px-4 py-4 whitespace-nowrap"><PersonCell employees={reviewers} /></td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => setViewingTask(task)}
                              className="inline-flex items-center gap-1.5 text-[#6F6F6F] hover:text-[#FF6537] text-xs font-medium cursor-pointer transition-colors"
                            >
                              <Eye size={13} /> ดู
                            </button>
                            {canSubmit && (
                              <button
                                type="button"
                                onClick={() => setSubmittingTask(task)}
                                className="inline-flex items-center gap-1.5 text-[#FF6537] hover:text-[#e6572c] text-xs font-medium cursor-pointer transition-colors"
                              >
                                <Send size={13} /> ส่งงาน
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}

        {activeTab === 'to_review' && (
          tasksToReview.length === 0 ? (
            <div className="bg-white border border-slate-100 rounded-2xl p-10 text-center text-slate-500 text-sm">
              ยังไม่มีงานที่รอให้คุณตรวจ
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-[0px_2px_7px_-1px_rgba(0,0,0,0.1)] overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-[#F9F9F9] text-[12px] font-semibold text-[#000000] border-b border-[#EDEEEF] whitespace-nowrap">
                    <th className="px-4 py-3">โครงการ</th>
                    <th className="px-4 py-3">ชื่องาน</th>
                    <th className="px-4 py-3">ผู้ส่งงาน</th>
                    <th className="px-4 py-3">บันทึกจากผู้ส่งงาน</th>
                    <th className="px-4 py-3">การกระทำ</th>
                  </tr>
                </thead>
                <tbody>
                  {tasksToReview.map((task) => {
                    const project = projectById.get(task.projectId);
                    const assignees = employees.filter((e) => task.assigneeEmployeeIds.includes(e.id));
                    return (
                      <tr key={task.id} className="border-b border-[#EDEEEF] last:border-b-0 hover:bg-slate-50">
                        <td className="px-4 py-4 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => project && onSelectProject(project.id)}
                            className="text-[#FF6537] font-medium hover:underline cursor-pointer disabled:no-underline disabled:text-[#6F6F6F] disabled:cursor-default"
                            disabled={!project}
                          >
                            {project?.title ?? 'ไม่ทราบโครงการ'}
                          </button>
                        </td>
                        <td className="px-4 py-4 font-medium text-[#272220] max-w-50 truncate">{task.title}</td>
                        <td className="px-4 py-4 whitespace-nowrap"><PersonCell employees={assignees} /></td>
                        <td className="px-4 py-4 text-[#6F6F6F] max-w-60 truncate">{task.submissionNote || 'ไม่มีบันทึกเพิ่มเติม'}</td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setReviewingTask(task)}
                            className="inline-flex items-center gap-1.5 text-[#0EA5E9] hover:text-[#0284c7] text-xs font-medium cursor-pointer transition-colors"
                          >
                            <ClipboardCheck size={13} /> ตรวจงาน
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}

        {activeTab === 'my_approvals' && (
          myApprovalRequests.length === 0 ? (
            <div className="bg-white border border-slate-100 rounded-2xl p-10 text-center text-slate-500 text-sm">
              ยังไม่มีคำขอที่รอให้คุณอนุมัติ
            </div>
          ) : (
            <div className="space-y-3">
              {myApprovalRequests.map((request) => {
                const project = request.entityType === 'project' ? projectById.get(request.entityId) : undefined;
                const task = request.entityType === 'project_task' ? projectTasks.find((t) => t.id === request.entityId) : undefined;
                const entityTitle = project?.title ?? task?.title ?? (request.entityType === 'project' ? 'โครงการ' : 'งาน');
                const requester = request.requestedBy ? employeeById.get(request.requestedBy) : undefined;
                return (
                  <PendingRequestCard
                    key={request.id}
                    request={request}
                    entityTitle={entityTitle}
                    requesterLabel={requester ? displayName(requester) : 'ไม่ทราบผู้ใช้งาน'}
                    canDecide
                    onDecide={(decision, note) => onDecideChangeRequest(request.id, decision, note)}
                  />
                );
              })}
            </div>
          )
        )}

        {activeTab === 'my_projects' && (
          myProjects.length === 0 ? (
            <div className="bg-white border border-slate-100 rounded-2xl p-10 text-center text-slate-500 text-sm">
              ยังไม่มีโครงการที่คุณดูแลหรือเป็นสมาชิก
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-[0px_2px_7px_-1px_rgba(0,0,0,0.1)] overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-[#F9F9F9] text-[12px] font-semibold text-[#000000] border-b border-[#EDEEEF] whitespace-nowrap">
                    <th className="px-4 py-3">รหัส</th>
                    <th className="px-4 py-3">เรื่อง</th>
                    <th className="px-4 py-3">บทบาท</th>
                    <th className="px-4 py-3">ความคืบหน้า</th>
                    <th className="px-4 py-3">วันที่สิ้นสุด</th>
                    <th className="px-4 py-3">สถานะ</th>
                    <th className="px-4 py-3">การกระทำ</th>
                  </tr>
                </thead>
                <tbody>
                  {myProjects.map((project) => {
                    const pill = STATUS_PILL[project.status];
                    const StatusIcon = STATUS_ICON[project.status];
                    const isOwner = project.ownerEmployeeIds.includes(currentUserId);
                    return (
                      <tr key={project.id} className="border-b border-[#EDEEEF] last:border-b-0 hover:bg-slate-50">
                        <td className="px-4 py-4 text-[#6F6F6F] whitespace-nowrap">{project.code}</td>
                        <td className="px-4 py-4 font-medium text-[#272220] whitespace-nowrap">{project.title}</td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${isOwner ? 'bg-[#FFF1EC] text-[#FF6537]' : 'bg-slate-100 text-slate-600'}`}>
                            {isOwner ? 'ผู้รับผิดชอบหลัก' : 'ผู้รับผิดชอบร่วม'}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          {project.progress === null ? (
                            <span className="text-[#6F6F6F]">ยังไม่มี</span>
                          ) : (
                            <div className="flex items-center gap-2 min-w-[100px]">
                              <div className="flex-1 h-2 rounded-full bg-[#F0F0F0] overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${project.progress}%`, backgroundColor: STATUS_DOT[project.status] }} />
                              </div>
                              <span className="text-xs text-[#6F6F6F] w-8 text-right">{project.progress}%</span>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-4 text-[#272220] whitespace-nowrap">{project.endDate ?? 'ยังไม่มี'}</td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap"
                            style={{ backgroundColor: pill.bg, color: pill.text }}
                          >
                            <StatusIcon size={12} strokeWidth={2} />
                            {STATUS_LABEL[project.status]}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => onSelectProject(project.id)}
                            className="inline-flex items-center gap-1.5 text-[#6F6F6F] hover:text-[#FF6537] text-xs font-medium cursor-pointer transition-colors"
                          >
                            <Eye size={13} /> ดูรายละเอียด
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}

        {activeTab === 'gantt' && (
          myTasks.length === 0 ? (
            <div className="bg-white border border-slate-100 rounded-2xl p-10 text-center text-slate-500 text-sm flex items-center justify-center gap-2">
              <CalendarIcon size={16} /> ยังไม่มีงานที่มีกำหนดส่งสำหรับแสดง Timeline
            </div>
          ) : (
            <ProjectGantt tasks={myTasks} employees={currentUser ? [currentUser] : employees} projects={projects} />
          )
        )}
      </div>

      <TaskDetailModal task={viewingTask} employees={employees} documents={documents} onClose={() => setViewingTask(null)} />

      <SubmitTaskModal
        task={submittingTask}
        employees={employees}
        documents={documents}
        projectDocFolderId={submittingTask ? projectById.get(submittingTask.projectId)?.docFolderId : undefined}
        projectMemberIds={submittingTaskProjectMemberIds}
        currentUserId={currentUserId}
        currentUserName={currentUser ? displayName(currentUser) : 'ผู้ใช้งานปัจจุบัน'}
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
    </div>
  );
}
