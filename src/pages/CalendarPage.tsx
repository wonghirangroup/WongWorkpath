import CalendarView from '../components/CalendarView';
import { useAppData } from '../context/AppDataContext';

export default function CalendarPage() {
  const { tasks, employees, leaveRequests, handleAddLeaveRequest } = useAppData();
  return (
    <CalendarView
      tasks={tasks}
      employees={employees}
      leaveRequests={leaveRequests}
      onAddLeaveRequest={handleAddLeaveRequest}
    />
  );
}
