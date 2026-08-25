import EmployeeManagement from '../components/EmployeeManagement';
import { useAppData } from '../context/AppDataContext';

export default function EmployeesPage() {
  const { employees, handleAddEmployee } = useAppData();
  return <EmployeeManagement employees={employees} onAddEmployee={handleAddEmployee} />;
}
