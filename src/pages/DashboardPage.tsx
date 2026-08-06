import Dashboard from '../components/Dashboard';
import { useAppData } from '../context/AppDataContext';

export default function DashboardPage() {
  const { tasks, employees, auditLogs, leaveRequests, handleApproveHandover, handleApproveLeave, openAddTaskModal } = useAppData();
  return (
    <Dashboard
      tasks={tasks}
      employees={employees}
      auditLogs={auditLogs}
      leaveRequests={leaveRequests}
      onApproveHandover={handleApproveHandover}
      onApproveLeave={handleApproveLeave}
      onAddTask={openAddTaskModal}
    />
  );
}
