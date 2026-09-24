import { useEffect, useMemo, useState } from 'react';
import { Employee } from './../types';
import { ProjectRow, ProjectTaskItem, CustomProjectStatus, CustomProjectType } from './projectBoard/types';
import { Wallet, Briefcase, AlertCircle, Users } from 'lucide-react';
import DashboardToolbar from './dashboard/DashboardToolbar';
import StatCard from './dashboard/StatCard';
import ProjectSummaryTable from './dashboard/ProjectSummaryTable';
import TaskSummaryTable from './dashboard/TaskSummaryTable';
import StatusDistributionChart from './dashboard/StatusDistributionChart';
import TaskStatusDistributionChart from './dashboard/TaskStatusDistributionChart';
import MyUpcomingTasks from './dashboard/MyUpcomingTasks';
import CreateProjectModal from './projectBoard/CreateProjectModal';
import { loadWidgetPrefs, saveWidgetPrefs } from './dashboard/widgetPrefs';
import { buildCsv, downloadCsv } from '../lib/csv';
import { STATUS_LABEL, TASK_STATUS_LABEL } from './projectBoard/statusMeta';
import { displayName } from './projectBoard/CreateProjectModal';
import { CreateProjectPayload } from '../lib/api';
import { canSeeAllProjects } from '../lib/permissions';
import { isResponsibleForProject } from '../lib/ownership';

function formatBaht(n: number): string {
  return `฿${Math.round(n).toLocaleString('th-TH')}`;
}

interface DashboardProps {
  projects: ProjectRow[];
  projectTasks: ProjectTaskItem[];
  employees: Employee[];
  currentUser: Employee | null;
  onCreateProject: (payload: Omit<CreateProjectPayload, 'createdBy'>) => Promise<{ id: string; folderCreated?: boolean }>;
  customProjectStatuses: CustomProjectStatus[];
  customProjectTypes: CustomProjectType[];
  onAddCustomProjectType: (label: string, abbreviation: string) => Promise<CustomProjectType>;
  onSelectProject: (id: string) => void;
  orgSections: string[];
}

export default function Dashboard({
  projects,
  projectTasks,
  employees,
  currentUser,
  onCreateProject,
  customProjectStatuses,
  customProjectTypes,
  onAddCustomProjectType,
  onSelectProject,
  orgSections
}: DashboardProps) {
  const [projectFilter, setProjectFilter] = useState('All');
  const [departmentFilter, setDepartmentFilter] = useState('__all__');
  const isExecutive = currentUser ? canSeeAllProjects(currentUser) : false;
  // Non-executive roles only ever see projects they own or are a member of — ผู้บริหาร sees the
  // whole company by default and gets an extra department filter (see below) on top of the
  // existing single-project picker.
  const visibleProjects = useMemo(
    () => (!currentUser || isExecutive ? projects : projects.filter((p) => isResponsibleForProject(p, currentUser.id))),
    [projects, currentUser, isExecutive]
  );
  const departmentFilteredProjects = useMemo(
    () => (isExecutive && departmentFilter !== '__all__' ? visibleProjects.filter((p) => p.department === departmentFilter) : visibleProjects),
    [visibleProjects, isExecutive, departmentFilter]
  );
  const [widgetPrefs, setWidgetPrefs] = useState(loadWidgetPrefs);
  useEffect(() => saveWidgetPrefs(widgetPrefs), [widgetPrefs]);

  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [actionToast, setActionToast] = useState<string | null>(null);

  // Same best-effort client-side preview as ProjectBoard's own create-project entry point — the
  // real code (and its sequence number) is always generated server-side at submit time. Sequence
  // runs per year only (see server/routes/projects.ts's generateProjectCode), so this scans every
  // project's code for this year regardless of its own type/abbreviation.
  const getNextCodePreview = (abbreviation: string, type: string | null) => {
    if (!abbreviation || !type) return 'จะสร้างอัตโนมัติ';
    const yy = String((new Date().getFullYear() + 543) % 100).padStart(2, '0');
    const yearCodePattern = new RegExp(`-${yy}-[A-Za-z]+-(\\d+)$`);
    const seqNumbers = projects
      .map((p) => Number(p.code.match(yearCodePattern)?.[1]))
      .filter((n) => !Number.isNaN(n));
    const next = (seqNumbers.length ? Math.max(...seqNumbers) : 0) + 1;
    return `${abbreviation}-${yy}-${type}-${String(next).padStart(3, '0')}`;
  };

  const employeeById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);

  // Picking one specific project switches the summary table/donut below from "which projects" to
  // "which tasks in this one project" — a single-row project table (or a 100%-one-status donut)
  // isn't useful once the scope is already down to one project.
  const isSingleProjectView = projectFilter !== 'All';
  const filteredProjects = isSingleProjectView ? departmentFilteredProjects.filter((p) => p.id === projectFilter) : departmentFilteredProjects;
  const singleProject = isSingleProjectView ? filteredProjects[0] : undefined;
  const filteredProjectIds = useMemo(() => new Set(filteredProjects.map((p) => p.id)), [filteredProjects]);
  const filteredProjectTasks = projectTasks.filter((t) => filteredProjectIds.has(t.projectId));

  const activeProjectsCount = filteredProjects.filter((p) => p.status === 'in_progress').length;
  const activeTasksCount = filteredProjectTasks.filter((t) => t.status === 'in_progress').length;
  // A task the reviewer bounced back (see ReviewTaskModal's reject flow) stays status 'in_progress'
  // with reviewNote set to why — cleared again the moment it's resubmitted (SubmitTaskModal) — so
  // this combination uniquely means "currently sitting rejected, not yet reworked", which counts as
  // an issue here alongside the assignee's own explicit 'blocked' status.
  const blockedCount = filteredProjectTasks.filter((t) => t.status === 'blocked' || (t.status === 'in_progress' && !!t.reviewNote)).length;
  const budgetedProjects = filteredProjects.filter((p) => p.budget !== null);
  const totalBudget = budgetedProjects.reduce((sum, p) => sum + (p.budget ?? 0), 0);

  const showSummaryTable = widgetPrefs.visible.summaryTable;
  const showStatusChart = widgetPrefs.visible.statusChart;
  const showMyTasks = widgetPrefs.visible.myTasks;

  const handleExportCsv = () => {
    if (isSingleProjectView && singleProject) {
      const headers = ['ชื่องาน', 'ผู้รับผิดชอบ', 'กำหนดส่ง', 'สถานะ', 'ความคืบหน้า (%)'];
      const rows = filteredProjectTasks.map((t) => {
        const assignees = t.assigneeEmployeeIds.map((id) => employeeById.get(id)).filter((e): e is Employee => Boolean(e));
        return [t.title, assignees.map((e) => displayName(e)).join(', '), t.dueDate ?? '', TASK_STATUS_LABEL[t.status], t.progress];
      });
      downloadCsv(`สรุปงาน-${singleProject.title}-${new Date().toISOString().slice(0, 10)}.csv`, buildCsv(headers, rows));
    } else {
      const headers = ['ชื่อโครงการ', 'ผู้รับผิดชอบหลัก', 'วันครบกำหนด', 'งบประมาณ', 'สถานะ', 'ความคืบหน้า (%)'];
      const rows = filteredProjects.map((p) => {
        const owners = p.ownerEmployeeIds.map((id) => employeeById.get(id)).filter((e): e is Employee => Boolean(e));
        return [p.title, owners.map((o) => displayName(o)).join(', '), p.endDate ?? '', p.budget ?? '', STATUS_LABEL[p.status], p.progress ?? ''];
      });
      downloadCsv(`แดชบอร์ด-${new Date().toISOString().slice(0, 10)}.csv`, buildCsv(headers, rows));
    }
  };

  const handleExportPdf = () => window.print();

  return (
    <div className="space-y-6" id="dashboard-tab">
      {/* Sticky under Header (same -top offset trick as EmployeeManagement's tab/toolbar bar) so
          the filter/action row stays put while the stat cards and widgets below scroll under it,
          instead of disappearing upward with the rest of the page. */}
      <div className="sticky -top-4 sm:-top-6 lg:-top-3.75 z-30 bg-[#F6F6F6] pt-1 print:hidden">
        <DashboardToolbar
          onCreateProject={() => setIsCreateProjectOpen(true)}
          onExportCsv={handleExportCsv}
          onExportPdf={handleExportPdf}
          projectFilter={projectFilter}
          onProjectFilterChange={setProjectFilter}
          projects={departmentFilteredProjects}
          widgetPrefs={widgetPrefs}
          onWidgetPrefsChange={setWidgetPrefs}
          showDepartmentFilter={isExecutive}
          departmentFilter={departmentFilter}
          onDepartmentFilterChange={setDepartmentFilter}
          departments={orgSections}
        />
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" id="overview-stats">
        <StatCard
          icon={<Wallet size={32} strokeWidth={2} />}
          iconColor="#FF6537"
          label="งบประมาณรวม"
          value={formatBaht(totalBudget)}
          detail={`จาก ${budgetedProjects.length} โครงการที่ตั้งงบไว้`}
        />
        {isSingleProjectView ? (
          <StatCard
            icon={<Briefcase size={32} strokeWidth={2} />}
            iconColor="#2563EB"
            label="งาน"
            value={filteredProjectTasks.length}
            detail={`กำลังดำเนินการ ${activeTasksCount} งาน`}
          />
        ) : (
          <StatCard
            icon={<Briefcase size={32} strokeWidth={2} />}
            iconColor="#2563EB"
            label="โครงการ"
            value={filteredProjects.length}
            detail={`กำลังดำเนินการ ${activeProjectsCount} โครงการ`}
          />
        )}
        <StatCard
          icon={<AlertCircle size={32} strokeWidth={2} />}
          iconColor="#E11D48"
          label="งานที่ติดปัญหา"
          value={blockedCount}
          detail="จากทุกโครงการที่กรองอยู่"
          detailClassName="text-rose-600 font-medium"
        />
        <StatCard
          icon={<Users size={32} strokeWidth={2} />}
          iconColor="#7C3AED"
          label="พนักงาน"
          value={employees.length}
          detail="ทั้งหมดในระบบ"
        />
      </div>

      {/* Summary table and the status donut share one row — the table takes two thirds, the donut
          the remaining third. Either one alone simply fills the row. Both switch from
          project-scoped to task-scoped the moment the toolbar filters down to one project. */}
      {(showSummaryTable || showStatusChart) && (
        <div className={showSummaryTable && showStatusChart ? 'grid grid-cols-1 lg:grid-cols-3 gap-6' : ''}>
          {showSummaryTable && (
            <div className={showStatusChart ? 'lg:col-span-2' : ''}>
              {isSingleProjectView && singleProject ? (
                <TaskSummaryTable tasks={filteredProjectTasks} employees={employees} projectTitle={singleProject.title} />
              ) : (
                <ProjectSummaryTable projects={filteredProjects} employees={employees} onSelectProject={onSelectProject} />
              )}
            </div>
          )}
          {showStatusChart && (
            isSingleProjectView && singleProject ? (
              <TaskStatusDistributionChart tasks={filteredProjectTasks} projectTitle={singleProject.title} />
            ) : (
              <StatusDistributionChart projects={filteredProjects} />
            )
          )}
        </div>
      )}

      {showMyTasks && (
        <MyUpcomingTasks
          projectTasks={projectTasks}
          projectById={new Map(projects.map((p) => [p.id, p]))}
          currentUserId={currentUser?.id ?? ''}
          onSelectProject={onSelectProject}
        />
      )}

      <CreateProjectModal
        isOpen={isCreateProjectOpen}
        onClose={() => setIsCreateProjectOpen(false)}
        getNextCodePreview={getNextCodePreview}
        onCreate={(payload) => onCreateProject(payload)}
        onCreated={(title, folderCreated) =>
          setActionToast(
            folderCreated
              ? `สร้างโครงการ "${title}" และโฟลเดอร์เอกสารสำเร็จแล้ว`
              : `สร้างโครงการ "${title}" สำเร็จแล้ว`
          )
        }
        employees={employees}
        existingTitles={projects.map((p) => p.title)}
        customStatuses={customProjectStatuses}
        customTypes={customProjectTypes}
        onAddCustomType={onAddCustomProjectType}
        projects={projects}
      />

      {actionToast && (
        <div className="fixed bottom-6 right-6 z-50">
          <div className="bg-slate-900 text-white rounded-xl shadow-xl px-5 py-3.5 flex items-center gap-4">
            <span className="text-sm">{actionToast}</span>
            <button
              onClick={() => setActionToast(null)}
              className="text-[#FF9776] font-semibold text-sm hover:underline cursor-pointer shrink-0"
            >
              ปิด
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
