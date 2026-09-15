import { useEffect, useMemo, useState } from 'react';
import { Employee } from './../types';
import { ProjectRow, ProjectTaskItem } from './projectBoard/types';
import { Wallet, Briefcase, AlertCircle, Users } from 'lucide-react';
import DashboardToolbar from './dashboard/DashboardToolbar';
import StatCard from './dashboard/StatCard';
import ProjectSummaryTable from './dashboard/ProjectSummaryTable';
import StatusDistributionChart from './dashboard/StatusDistributionChart';
import MyUpcomingTasks from './dashboard/MyUpcomingTasks';
import TeamActivityList from './dashboard/TeamActivityList';
import { loadWidgetPrefs, saveWidgetPrefs } from './dashboard/widgetPrefs';

function formatBaht(n: number): string {
  return `฿${Math.round(n).toLocaleString('th-TH')}`;
}

interface DashboardProps {
  projects: ProjectRow[];
  projectTasks: ProjectTaskItem[];
  employees: Employee[];
  orgSections: string[];
  currentUser: Employee | null;
  onAddTask: () => void;
  onSelectProject: (id: string) => void;
}

export default function Dashboard({
  projects,
  projectTasks,
  employees,
  orgSections,
  currentUser,
  onAddTask,
  onSelectProject
}: DashboardProps) {
  const [departmentFilter, setDepartmentFilter] = useState('All');
  const [projectFilter, setProjectFilter] = useState('All');
  const [widgetPrefs, setWidgetPrefs] = useState(loadWidgetPrefs);
  useEffect(() => saveWidgetPrefs(widgetPrefs), [widgetPrefs]);

  const employeeById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);
  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  // ProjectRow.department has no input UI anywhere yet (a real, separate gap) — falling back to
  // the project owner's own department keeps every department-scoped widget on this page
  // meaningful today instead of every project landing in one "ไม่ระบุ" bucket.
  const getEffectiveDepartment = (project: ProjectRow): string =>
    project.department || (project.ownerEmployeeId && employeeById.get(project.ownerEmployeeId)?.department) || 'ไม่ระบุ';

  // A specific project pick takes precedence over the department filter — picking one project
  // narrows every widget on this page down to just that project, department filter or not.
  const filteredProjects = projectFilter !== 'All'
    ? projects.filter((p) => p.id === projectFilter)
    : departmentFilter === 'All'
    ? projects
    : projects.filter((p) => getEffectiveDepartment(p) === departmentFilter);
  const filteredProjectIds = useMemo(() => new Set(filteredProjects.map((p) => p.id)), [filteredProjects]);
  const filteredProjectTasks = projectTasks.filter((t) => filteredProjectIds.has(t.projectId));
  const filteredEmployees = departmentFilter === 'All'
    ? employees
    : employees.filter((e) => e.department === departmentFilter);

  const activeProjectsCount = filteredProjects.filter((p) => p.status === 'in_progress').length;
  const blockedCount = filteredProjectTasks.filter((t) => t.status === 'blocked').length;
  const budgetedProjects = filteredProjects.filter((p) => p.budget !== null);
  const totalBudget = budgetedProjects.reduce((sum, p) => sum + (p.budget ?? 0), 0);

  const getEmployeeActiveTasks = (empId: string) =>
    filteredProjectTasks.filter((t) => t.assigneeEmployeeIds.includes(empId) && t.status !== 'done');

  const showSummaryTable = widgetPrefs.visible.summaryTable;
  const showStatusChart = widgetPrefs.visible.statusChart;
  const showMyTasks = widgetPrefs.visible.myTasks;
  const showWorkload = widgetPrefs.visible.workload;

  const handleExport = () => window.print();

  return (
    <div className="space-y-6" id="dashboard-tab">
      {/* Sticky under Header (same -top offset trick as EmployeeManagement's tab/toolbar bar) so
          the filter/action row stays put while the stat cards and widgets below scroll under it,
          instead of disappearing upward with the rest of the page. */}
      <div className="sticky -top-4 sm:-top-6 lg:-top-8 z-30 bg-[#F6F6F6] pt-1 print:hidden">
        <DashboardToolbar
          onAddTask={onAddTask}
          onExport={handleExport}
          departmentFilter={departmentFilter}
          onDepartmentFilterChange={setDepartmentFilter}
          orgSections={orgSections}
          projectFilter={projectFilter}
          onProjectFilterChange={setProjectFilter}
          projects={projects}
          widgetPrefs={widgetPrefs}
          onWidgetPrefsChange={setWidgetPrefs}
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
        <StatCard
          icon={<Briefcase size={32} strokeWidth={2} />}
          iconColor="#2563EB"
          label="โครงการ"
          value={filteredProjects.length}
          detail={`กำลังดำเนินการ ${activeProjectsCount} โครงการ`}
        />
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
          value={filteredEmployees.length}
          detail="ทั้งหมดในระบบ"
        />
      </div>

      {/* Summary table and the status donut share one row — the table takes two thirds, the donut
          the remaining third. Either one alone simply fills the row. */}
      {(showSummaryTable || showStatusChart) && (
        <div className={showSummaryTable && showStatusChart ? 'grid grid-cols-1 lg:grid-cols-3 gap-6' : ''}>
          {showSummaryTable && (
            <div className={showStatusChart ? 'lg:col-span-2' : ''}>
              <ProjectSummaryTable projects={filteredProjects} employees={employees} onSelectProject={onSelectProject} />
            </div>
          )}
          {showStatusChart && <StatusDistributionChart projects={filteredProjects} />}
        </div>
      )}

      {(showMyTasks || showWorkload) && (
        <div className={`grid grid-cols-1 gap-6 ${showMyTasks && showWorkload ? 'lg:grid-cols-2' : ''}`}>
          {showMyTasks && (
            <MyUpcomingTasks
              projectTasks={projectTasks}
              projectById={projectById}
              currentUserId={currentUser?.id ?? ''}
              onSelectProject={onSelectProject}
            />
          )}
          {showWorkload && (
            <TeamActivityList employees={employees} getEmployeeActiveTasks={getEmployeeActiveTasks} />
          )}
        </div>
      )}
    </div>
  );
}
