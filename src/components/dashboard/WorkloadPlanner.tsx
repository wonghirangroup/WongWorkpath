import { Users } from 'lucide-react';
import { Employee, Task } from '../../types';
import WorkloadItem from './WorkloadItem';

interface WorkloadPlannerProps {
  employees: Employee[];
  getEmployeeActiveTasks: (empId: string) => Task[];
}

export default function WorkloadPlanner({ employees, getEmployeeActiveTasks }: WorkloadPlannerProps) {
  return (
    <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-xs space-y-4" id="manpower-planner">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-900">เครื่องมือวิเคราะห์ภาระงาน (Manpower Workload Planner)</h3>
          <p className="text-xs text-slate-500">ตรวจสอบภาระงานปัจจุบันของพนักงานแต่ละคนเพื่อกระจายงานได้อย่างเหมาะสม</p>
        </div>
        <span className="text-xs bg-slate-100 text-slate-600 font-semibold px-2.5 py-1 rounded-lg flex items-center gap-1">
          <Users size={12} /> {employees.length} คน
        </span>
      </div>

      <div className="space-y-4 pt-2">
        {employees.map(emp => (
          <WorkloadItem key={emp.id} employee={emp} activeTasks={getEmployeeActiveTasks(emp.id)} />
        ))}
      </div>
    </div>
  );
}
