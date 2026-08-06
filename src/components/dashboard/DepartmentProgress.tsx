import { Task } from '../../types';

interface DepartmentProgressProps {
  tasks: Task[];
}

const DEPARTMENT_COLORS: Record<string, string> = {
  IT: 'bg-indigo-600',
  Design: 'bg-fuchsia-600',
  Marketing: 'bg-pink-600',
  Finance: 'bg-emerald-600',
};

export default function DepartmentProgress({ tasks }: DepartmentProgressProps) {
  const departmentStats: Record<string, { total: number; completed: number }> = {};
  tasks.forEach(t => {
    if (!departmentStats[t.department]) {
      departmentStats[t.department] = { total: 0, completed: 0 };
    }
    departmentStats[t.department].total += 1;
    if (t.status === 'Completed') {
      departmentStats[t.department].completed += 1;
    }
  });

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs space-y-4">
      <div>
        <h3 className="text-base font-bold text-slate-900">อัตราความคืบหน้าโครงการรายแผนก</h3>
        <p className="text-xs text-slate-500">แสดงจำนวนงานและการเสร็จสิ้นแบ่งตามส่วนงาน</p>
      </div>

      <div className="space-y-4 pt-2">
        {Object.keys(departmentStats).length === 0 ? (
          <p className="text-center text-xs text-slate-400 py-6">ไม่มีข้อมูลงาน</p>
        ) : (
          Object.entries(departmentStats).map(([dept, data]) => {
            const completionRate = data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0;
            return (
              <div key={dept} className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-700">{dept} Department</span>
                  <span className="text-slate-500">
                    เสร็จ {data.completed}/{data.total} งาน ({completionRate}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden flex">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${DEPARTMENT_COLORS[dept] || 'bg-slate-500'}`}
                    style={{ width: `${completionRate}%` }}
                  ></div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
