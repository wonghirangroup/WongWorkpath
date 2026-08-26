import EmployeeManagement from '../components/EmployeeManagement';
import { useAppData } from '../context/AppDataContext';

export default function EmployeesPage() {
  const { employees, auditLogs, currentUser, handleAddEmployee, handleUpdateEmployee, handleDeleteEmployee } = useAppData();
  return (
    <EmployeeManagement
      employees={employees}
      auditLogs={auditLogs}
      currentUserId={currentUser?.id}
      onAddEmployee={handleAddEmployee}
      onUpdateEmployee={handleUpdateEmployee}
      onDeleteEmployee={handleDeleteEmployee}
    />
  );
}
