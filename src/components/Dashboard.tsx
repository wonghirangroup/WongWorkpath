import { Task, Employee, AuditLog, LeaveRequest } from '../types';
import { CheckCircle, Clock, Briefcase, TrendingUp } from 'lucide-react';
import WelcomeBanner from './dashboard/WelcomeBanner';
import StatCard from './dashboard/StatCard';
import WorkloadPlanner from './dashboard/WorkloadPlanner';
import ActionCenter from './dashboard/ActionCenter';
import DepartmentProgress from './dashboard/DepartmentProgress';
import KPIRankings from './dashboard/KPIRankings';
import AuditTrail from './dashboard/AuditTrail';

interface DashboardProps {
  tasks: Task[];
  employees: Employee[];
  auditLogs: AuditLog[];
  leaveRequests: LeaveRequest[];
  onApproveHandover: (taskId: string, handoverId: string, approved: boolean, notes: string) => void;
  onApproveLeave: (leaveId: string, approved: boolean) => void;
  onAddTask: () => void;
}

export default function Dashboard({
  tasks,
  employees,
  auditLogs,
  leaveRequests,
  onApproveHandover,
  onApproveLeave,
  onAddTask
}: DashboardProps) {

  // Calculations
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'Completed').length;
  const inProgressTasks = tasks.filter(t => t.status === 'In Progress').length;
  const notStartedTasks = tasks.filter(t => t.status === 'Not Started').length;
  const onHoldTasks = tasks.filter(t => t.status === 'On Hold').length;

  const pendingLeaveRequests = leaveRequests.filter(r => r.status === 'Pending');

  const averageProgress = totalTasks > 0
    ? Math.round(tasks.reduce((sum, t) => sum + t.progress, 0) / totalTasks)
    : 0;

  // Workload analysis: count tasks assigned to each employee (In Progress, Not Started)
  const getEmployeeActiveTasks = (empId: string) => {
    return tasks.filter(t => t.primaryOwnerId === empId && (t.status === 'In Progress' || t.status === 'Not Started'));
  };

  return (
    <div className="space-y-6" id="dashboard-tab">
      <WelcomeBanner onAddTask={onAddTask} />

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" id="overview-stats">
        <StatCard
          icon={<Briefcase size={22} />}
          iconBgClass="bg-blue-50 text-blue-600"
          label="งานทั้งหมดในระบบ"
          value={totalTasks}
          detail={`กําลังทํา ${inProgressTasks} | รอดําเนินการ ${notStartedTasks}`}
        />
        <StatCard
          icon={<CheckCircle size={22} />}
          iconBgClass="bg-emerald-50 text-emerald-600"
          label="เสร็จสมบูรณ์"
          value={completedTasks}
          detail={`คิดเป็น ${totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0}% ของทั้งหมด`}
          detailClassName="text-emerald-600 font-medium"
        />
        <StatCard
          icon={<TrendingUp size={22} />}
          iconBgClass="bg-amber-50 text-amber-600"
          label="ความก้าวหน้าเฉลี่ย"
          value={`${averageProgress}%`}
          detail={
            <div className="w-24 bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
              <div className="bg-amber-500 h-full rounded-full" style={{ width: `${averageProgress}%` }} />
            </div>
          }
        />
        <StatCard
          icon={<Clock size={22} />}
          iconBgClass="bg-rose-50 text-rose-600"
          label="การปิดระงับงาน / ลาพัก"
          value={`${onHoldTasks} งาน`}
          detail={`มีใบลาที่รออนุมัติ ${pendingLeaveRequests.length} รายการ`}
          detailClassName="text-rose-600 font-medium"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <WorkloadPlanner employees={employees} getEmployeeActiveTasks={getEmployeeActiveTasks} />
        <ActionCenter
          tasks={tasks}
          employees={employees}
          leaveRequests={leaveRequests}
          onApproveHandover={onApproveHandover}
          onApproveLeave={onApproveLeave}
        />
      </div>

      {/* Production & Productivity KPIs + Recent Audit Trail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <DepartmentProgress tasks={tasks} />
        <KPIRankings employees={employees} tasks={tasks} />
        <AuditTrail auditLogs={auditLogs} />
      </div>
    </div>
  );
}
