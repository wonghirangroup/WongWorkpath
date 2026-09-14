import { Employee } from '../../types';
import { ProjectTaskItem } from '../projectBoard/types';
import TeamActivityItem from './TeamActivityItem';

interface TeamActivityListProps {
  employees: Employee[];
  getEmployeeActiveTasks: (empId: string) => ProjectTaskItem[];
}

// Plain "who's doing what" visibility — deliberately not a workload-balancing/analysis tool (no
// headcount badge, no over/under-allocation framing). Only lists employees who actually have at
// least one active task; with the real employee roster this can be dozens of people, and a wall
// of empty rows would bury the ones that matter.
export default function TeamActivityList({ employees, getEmployeeActiveTasks }: TeamActivityListProps) {
  const active = employees
    .map((emp) => ({ emp, tasks: getEmployeeActiveTasks(emp.id) }))
    .filter(({ tasks }) => tasks.length > 0)
    .sort((a, b) => b.tasks.length - a.tasks.length);

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-[0px_2px_7px_-1px_rgba(0,0,0,0.1)] space-y-4 h-full" id="team-activity">
      <div>
        <h3 className="text-base font-bold text-[#272220]">ใครทำอะไรอยู่บ้าง</h3>
        <p className="text-xs text-[#6F6F6F]">ภาพรวมงานที่พนักงานแต่ละคนกำลังรับผิดชอบอยู่ในตอนนี้</p>
      </div>

      <div className="space-y-4 pt-2">
        {active.length === 0 ? (
          <p className="text-center text-xs text-[#A0A0A0] py-6">ยังไม่มีใครมีงานที่กำลังดำเนินการอยู่</p>
        ) : (
          active.map(({ emp, tasks }) => (
            <TeamActivityItem key={emp.id} employee={emp} activeTasks={tasks} />
          ))
        )}
      </div>
    </div>
  );
}
