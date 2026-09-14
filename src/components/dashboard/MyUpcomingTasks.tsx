import { ProjectRow, ProjectTaskItem } from '../projectBoard/types';
import { TASK_STATUS_LABEL, TASK_STATUS_COLOR } from '../projectBoard/statusMeta';

interface MyUpcomingTasksProps {
  projectTasks: ProjectTaskItem[];
  projectById: Map<string, ProjectRow>;
  currentUserId: string;
  onSelectProject: (id: string) => void;
}

// "My" tasks stay personal regardless of the toolbar's department filter — an executive scoped
// to one department should still see their own outstanding work, not have it hidden by a filter
// meant for browsing OTHER people's projects. Tasks with a due date sort soonest/overdue first;
// tasks with none (still genuinely "ค้างอยู่" / pending) sort to the end rather than being dropped.
export default function MyUpcomingTasks({ projectTasks, projectById, currentUserId, onSelectProject }: MyUpcomingTasksProps) {
  const mine = projectTasks
    .filter((t) => t.assigneeEmployeeIds.includes(currentUserId) && t.status !== 'done')
    .sort((a, b) => (a.daysUntilDue ?? Infinity) - (b.daysUntilDue ?? Infinity))
    .slice(0, 8);

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-[0px_2px_7px_-1px_rgba(0,0,0,0.1)] h-full flex flex-col">
      <div className="mb-4">
        <h3 className="text-base font-bold text-[#272220]">งานของฉันที่ใกล้ครบกำหนด</h3>
        <p className="text-xs text-[#6F6F6F]">งานที่คุณรับผิดชอบและยังไม่เสร็จสิ้น</p>
      </div>

      {mine.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-xs text-[#A0A0A0] py-6">ไม่มีงานที่ค้างอยู่ในตอนนี้</div>
      ) : (
        <div className="space-y-1 flex-1 overflow-y-auto max-h-90">
          {mine.map((t) => {
            const project = projectById.get(t.projectId);
            const overdue = t.daysUntilDue !== undefined && t.daysUntilDue < 0;
            const color = TASK_STATUS_COLOR[t.status];
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => project && onSelectProject(project.id)}
                className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 cursor-pointer text-left transition-colors"
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[#272220] truncate">{t.title}</p>
                  <p className="text-[11px] text-[#A0A0A0] truncate">{project?.title ?? 'ไม่ทราบโครงการ'}</p>
                </div>
                <div className="text-right shrink-0 flex flex-col items-end gap-1">
                  <span
                    className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: `${color}1A`, color }}
                  >
                    {TASK_STATUS_LABEL[t.status]}
                  </span>
                  {t.daysUntilDue !== undefined && (
                    <span className={`text-[10px] ${overdue ? 'text-[#FF2A04] font-semibold' : 'text-[#A0A0A0]'}`}>
                      {overdue ? 'เลยกำหนดแล้ว' : `อีก ${t.daysUntilDue} วัน`}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
