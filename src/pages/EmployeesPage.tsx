import EmployeeManagement from '../components/EmployeeManagement';
import EmployeeDirectory from '../components/EmployeeDirectory';
import { useAppData } from '../context/AppDataContext';
import { canManageEmployees } from '../lib/permissions';

export default function EmployeesPage() {
  const { employees, auditLogs, currentUser, orgDivisions, handleAddEmployee, handleUpdateEmployee, handleDeleteEmployee } = useAppData();

  if (!currentUser || !canManageEmployees(currentUser)) {
    return <EmployeeDirectory employees={employees} orgDivisions={orgDivisions} currentUserId={currentUser?.id} />;
  }

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
