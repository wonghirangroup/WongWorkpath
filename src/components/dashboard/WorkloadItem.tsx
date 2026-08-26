import { Employee, Task } from '../../types';

interface WorkloadItemProps {
  employee: Employee;
  activeTasks: Task[];
}

export default function WorkloadItem({ employee: emp, activeTasks }: WorkloadItemProps) {
  const activeCount = activeTasks.length;

  return (
    <div className="p-4 rounded-xl border border-slate-100 hover:border-slate-200 transition-all bg-slate-50/50">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
        <div className="flex items-center gap-3">
          <img
            src={emp.avatar}
            alt={emp.name}
            className="w-10 h-10 rounded-full object-cover ring-2 ring-white shadow-xs"
          />
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold text-slate-900">{emp.name}</h4>
              <span className="text-[10px] bg-indigo-50 text-indigo-700 font-medium px-2 py-0.5 rounded-full">
                {emp.department}
              </span>
            </div>
            <p className="text-xs text-slate-500">{emp.role}</p>
          </div>
        </div>

        <p className="text-xs font-semibold text-slate-700">
          ภาระงาน: <span className="text-indigo-600">{activeCount}</span> งาน
        </p>
      </div>

      {activeCount > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          <span className="text-[10px] text-slate-400 self-center mr-1">งานปัจจุบัน:</span>
          {activeTasks.map(t => (
            <span
              key={t.id}
              className="text-[10px] bg-white border border-slate-200 text-slate-600 px-2 py-0.5 rounded-md shadow-2xs truncate max-w-[150px]"
              title={t.title}
            >
              {t.title}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
