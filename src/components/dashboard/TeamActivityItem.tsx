import { Employee } from '../../types';
import { ProjectTaskItem } from '../projectBoard/types';
import { getDepartmentTagClass } from '../../lib/departmentColors';

interface TeamActivityItemProps {
  employee: Employee;
  activeTasks: ProjectTaskItem[];
}

export default function TeamActivityItem({ employee: emp, activeTasks }: TeamActivityItemProps) {
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
              <h4 className="text-sm font-semibold text-[#272220]">{emp.name}</h4>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${getDepartmentTagClass(emp.department)}`}>
                {emp.department}
              </span>
            </div>
            <p className="text-xs text-[#6F6F6F]">{emp.role}</p>
          </div>
        </div>

        <p className="text-xs font-semibold text-[#272220]">
          กำลังทำ <span className="text-[#FF6537]">{activeTasks.length}</span> งาน
        </p>
      </div>

      {activeTasks.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          <span className="text-[10px] text-[#A0A0A0] self-center mr-1">งานปัจจุบัน:</span>
          {activeTasks.map(t => (
            <span
              key={t.id}
              className="text-[10px] bg-white border border-slate-200 text-[#6F6F6F] px-2 py-0.5 rounded-md shadow-2xs truncate max-w-[150px]"
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
