import { useEffect, useMemo, useState } from 'react';
import { Employee } from './../types';
import { ProjectRow, ProjectTaskItem } from './projectBoard/types';
import { Wallet, Briefcase, AlertCircle, Users } from 'lucide-react';
import DashboardToolbar from './dashboard/DashboardToolbar';
import StatCard from './dashboard/StatCard';
import ProjectSummaryTable from './dashboard/ProjectSummaryTable';
import OverallProgressGauge from './dashboard/OverallProgressGauge';
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
  const [widgetPrefs, setWidgetPrefs] = useState(loadWidgetPrefs);
  useEffect(() => saveWidgetPrefs(widgetPrefs), [widgetPrefs]);

  const employeeById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);
  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  // ProjectRow.department has no input UI anywhere yet (a real, separate gap) — falling back to
  // the project owner's own department keeps every department-scoped widget on this page
  // meaningful today instead of every project landing in one "ไม่ระบุ" bucket.
  const getEffectiveDepartment = (project: ProjectRow): string =>
    project.department || (project.ownerEmployeeId && employeeById.get(project.ownerEmployeeId)?.department) || 'ไม่ระบุ';

  const filteredProjects = departmentFilter === 'All'
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

  // "จัดกลุ่มตามแผนก" splits the progress gauge below into one card per department instead of a
  // single combined view, so an executive can watch several projects' status move meaningfully at
  // the same time without them blending into one aggregate number.
  const departmentGroupMap = new Map<string, ProjectRow[]>();
  filteredProjects.forEach((p) => {
    const dept = getEffectiveDepartment(p);
    if (!departmentGroupMap.has(dept)) departmentGroupMap.set(dept, []);
    departmentGroupMap.get(dept)!.push(p);
  });
  const departmentGroups = Array.from(departmentGroupMap.entries());
  const { groupByDepartment } = widgetPrefs;
  const showSummaryTable = widgetPrefs.visible.summaryTable;
  const showProgressGauge = widgetPrefs.visible.progressGauge;
  const showMyTasks = widgetPrefs.visible.myTasks;
  const showWorkload = widgetPrefs.visible.workload;

  const handleExport = () => window.print();

  return (
    <div className="space-y-6" id="dashboard-tab">
      <DashboardToolbar
        onAddTask={onAddTask}
        onExport={handleExport}
        departmentFilter={departmentFilter}
        onDepartmentFilterChange={setDepartmentFilter}
        orgSections={orgSections}
        widgetPrefs={widgetPrefs}
        onWidgetPrefsChange={setWidgetPrefs}
      />

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

      {showSummaryTable && (
        <div className={groupByDepartment || !showProgressGauge ? '' : 'grid grid-cols-1 lg:grid-cols-3 gap-6'}>
          <div className={groupByDepartment || !showProgressGauge ? '' : 'lg:col-span-2'}>
            <ProjectSummaryTable projects={filteredProjects} employees={employees} onSelectProject={onSelectProject} />
          </div>
          {!groupByDepartment && showProgressGauge && (
            <OverallProgressGauge projects={filteredProjects} />
          )}
        </div>
      )}

      {(groupByDepartment || !showSummaryTable) && showProgressGauge && (
        groupByDepartment ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {departmentGroups.map(([dept, projs]) => (
              <OverallProgressGauge key={dept} projects={projs} titleOverride={`ความคืบหน้า — ${dept}`} />
            ))}
          </div>
        ) : (
          <div className="max-w-md">
            <OverallProgressGauge projects={filteredProjects} />
          </div>
        )
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
