import { Employee, Task } from '../../types';

interface KPIRankingsProps {
  employees: Employee[];
  tasks: Task[];
}

function getScoreColor(avgProgress: number, hasTasks: boolean) {
  if (avgProgress >= 80) return 'text-emerald-700 bg-emerald-50';
  if (avgProgress >= 50) return 'text-amber-700 bg-amber-50';
  if (hasTasks) return 'text-rose-700 bg-rose-50';
  return 'text-slate-600 bg-slate-50';
}

export default function KPIRankings({ employees, tasks }: KPIRankingsProps) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs space-y-4">
      <div>
        <h3 className="text-base font-bold text-slate-900">อันดับตัวชี้วัดประสิทธิภาพ (KPIs)</h3>
        <p className="text-xs text-slate-500">คำนวณจากเปอร์เซ็นต์ความคืบหน้าเฉลี่ยของงานที่รับผิดชอบ</p>
      </div>

      <div className="space-y-3 pt-2">
        {employees.map(emp => {
          const empTasks = tasks.filter(t => t.primaryOwnerId === emp.id);
          const avgProgress = empTasks.length > 0
            ? Math.round(empTasks.reduce((sum, t) => sum + t.progress, 0) / empTasks.length)
            : 0;
          const scoreColor = getScoreColor(avgProgress, empTasks.length > 0);

          return (
            <div key={emp.id} className="flex items-center justify-between text-xs p-2 rounded-xl border border-slate-50">
              <div className="flex items-center gap-2.5">
                <img src={emp.avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
                <div>
                  <h4 className="font-semibold text-slate-800">{emp.name}</h4>
                  <p className="text-[10px] text-slate-400">ดูแล {empTasks.length} งาน</p>
                </div>
              </div>

              <span className={`font-bold px-2.5 py-1 rounded-lg ${scoreColor}`}>
                {empTasks.length > 0 ? `${avgProgress}%` : 'ไม่มีงาน'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
