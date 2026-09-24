import { Employee } from '../../types';
import { ProjectTaskItem } from '../projectBoard/types';
import { TASK_STATUS_LABEL, TASK_STATUS_COLOR } from '../projectBoard/statusMeta';
import { displayName } from '../projectBoard/CreateProjectModal';
import { getAvatarColor } from '../../lib/avatarColor';
import Tooltip from '../Tooltip';

// Same single-ring technique as ProjectSummaryTable's own MiniProgressRing, kept local here since
// the two tables are never shown at the same time (this one replaces that one once the dashboard
// is filtered down to a single project — see Dashboard.tsx's isSingleProjectView).
function MiniProgressRing({ progress, color }: { progress: number; color: string }) {
  const size = 40;
  const stroke = 5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, progress));
  const offset = circumference * (1 - clamped / 100);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="#F0F0F0" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[9px] font-bold text-[#272220]">{clamped}%</span>
      </div>
    </div>
  );
}

interface TaskSummaryTableProps {
  tasks: ProjectTaskItem[];
  employees: Employee[];
  projectTitle: string;
  onSelectTask?: (task: ProjectTaskItem) => void;
}

// The dashboard's project-scoped view of "สรุปโครงการ" — once a single project is picked in the
// toolbar filter, a table of that project's own tasks is far more useful here than a one-row
// table of projects (which is all `ProjectSummaryTable` would otherwise show for a single-project
// filter). No status/responsible-person filters here by design — the project filter above already
// narrowed the scope once; a second layer of filtering on top of that just added clicks.
// One indent step per nesting level, and the x of the vertical guide inside a level's gutter.
const TREE_INDENT_PX = 18;
const guideX = (level: number) => (level - 1) * TREE_INDENT_PX + 8;

interface TaskRow {
  task: ProjectTaskItem;
  depth: number;
  parentTitle?: string;
  subtaskCount: number;
  // Tree guides for a งานย่อย row: `hasNextSibling` decides whether its own vertical guide runs on
  // through the row (more siblings below) or stops at the elbow (last one); `throughLevels` lists
  // the ancestor levels whose guide must keep running straight past this row.
  hasNextSibling: boolean;
  throughLevels: number[];
}

export default function TaskSummaryTable({ tasks, employees, projectTitle, onSelectTask }: TaskSummaryTableProps) {
  const employeeById = new Map(employees.map((e) => [e.id, e]));

  // งานย่อย sit directly under their งานแม่ (nested to any depth) instead of being scattered by due
  // date among unrelated tasks, so it's always clear which task each one belongs to. The old
  // "closest deadline first" order is kept, but applied to each whole family: a group is ranked by
  // the most urgent due date anywhere inside it, so a parent with no date of its own whose
  // subtask is due tomorrow still floats to the top instead of sinking to the bottom.
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const childrenByParent = new Map<string, ProjectTaskItem[]>();
  tasks.forEach((t) => {
    if (t.parentTaskId && taskById.has(t.parentTaskId)) {
      const list = childrenByParent.get(t.parentTaskId) ?? [];
      list.push(t);
      childrenByParent.set(t.parentTaskId, list);
    }
  });
  const urgencyCache = new Map<string, number>();
  const urgencyOf = (t: ProjectTaskItem, trail: Set<string> = new Set()): number => {
    const cached = urgencyCache.get(t.id);
    if (cached !== undefined) return cached;
    if (trail.has(t.id)) return Infinity; // defensive: a parent loop can't exist in the DB, but never recurse forever
    trail.add(t.id);
    const value = Math.min(t.daysUntilDue ?? Infinity, ...(childrenByParent.get(t.id) ?? []).map((c) => urgencyOf(c, trail)));
    urgencyCache.set(t.id, value);
    return value;
  };
  const byUrgency = (a: ProjectTaskItem, b: ProjectTaskItem) => urgencyOf(a) - urgencyOf(b);

  const rows: TaskRow[] = [];
  const visited = new Set<string>();
  const visit = (t: ProjectTaskItem, depth: number, hasNextSibling: boolean, throughLevels: number[]) => {
    if (visited.has(t.id)) return;
    visited.add(t.id);
    const kids = [...(childrenByParent.get(t.id) ?? [])].sort(byUrgency);
    rows.push({
      task: t,
      depth,
      parentTitle: depth > 0 && t.parentTaskId ? taskById.get(t.parentTaskId)?.title : undefined,
      subtaskCount: kids.length,
      hasNextSibling,
      throughLevels,
    });
    // This row's own level keeps a guide running past its children only if it has later siblings.
    const nextThrough = depth > 0 && hasNextSibling ? [...throughLevels, depth] : throughLevels;
    kids.forEach((kid, idx) => visit(kid, depth + 1, idx < kids.length - 1, nextThrough));
  };
  tasks
    .filter((t) => !t.parentTaskId || !taskById.has(t.parentTaskId))
    .sort(byUrgency)
    .forEach((root) => visit(root, 0, false, []));
  // Anything left over could only be part of a parent loop — still show it rather than drop a task.
  tasks.forEach((t) => visit(t, 0, false, []));

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-[0px_2px_7px_-1px_rgba(0,0,0,0.1)] h-full flex flex-col">
      <div className="mb-4">
        <h3 className="text-base font-bold text-[#272220]">สรุปงาน (Task Summary)</h3>
        <p className="text-xs text-[#6F6F6F]">งานทั้งหมดของโครงการ "{projectTitle}"</p>
      </div>

      {rows.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-xs text-[#A0A0A0] py-6">ยังไม่มีงานในโครงการนี้</div>
      ) : (
        <div className="flex-1 overflow-auto max-h-90">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] text-[#A0A0A0] border-b border-slate-100">
                <th className="pb-2 font-semibold">ชื่องาน</th>
                <th className="pb-2 font-semibold">ผู้รับผิดชอบ</th>
                <th className="pb-2 font-semibold">กำหนดส่ง</th>
                <th className="pb-2 font-semibold">สถานะ</th>
                <th className="pb-2 font-semibold text-right">ความคืบหน้า</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ task: t, depth, parentTitle, subtaskCount, hasNextSibling, throughLevels }) => {
                const assignees = t.assigneeEmployeeIds.map((id) => employeeById.get(id)).filter((e): e is Employee => Boolean(e));
                const firstAssignee = assignees[0];
                const overdue = t.daysUntilDue !== undefined && t.daysUntilDue < 0;
                const color = TASK_STATUS_COLOR[t.status];
                return (
                  <tr
                    key={t.id}
                    onClick={() => onSelectTask?.(t)}
                    className={`border-b border-slate-50 last:border-0 transition-colors ${onSelectTask ? 'hover:bg-slate-50 cursor-pointer' : ''}`}
                  >
                    <td className="relative py-2.5 pr-3 max-w-40">
                      {/* Tree connector for a งานย่อย — same light grey as the Gantt's own parent→subtask
                          line. Ancestor levels that still have siblings below keep their
                          guide running straight through this row; this row's own level runs the full
                          height when more siblings follow, or stops at the elbow when it's the last. */}
                      {throughLevels.map((level) => (
                        <span key={level} aria-hidden className="absolute top-0 bottom-0 w-px bg-slate-300" style={{ left: guideX(level) }} />
                      ))}
                      {depth > 0 && (
                        <>
                          <span
                            aria-hidden
                            className="absolute top-0 w-px bg-slate-300"
                            style={{ left: guideX(depth), bottom: hasNextSibling ? 0 : '50%' }}
                          />
                          <span
                            aria-hidden
                            className="absolute top-1/2 h-px bg-slate-300"
                            style={{ left: guideX(depth), width: 10 }}
                          />
                        </>
                      )}
                      <div className="min-w-0" style={{ paddingLeft: depth > 0 ? depth * TREE_INDENT_PX + 6 : 0 }}>
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Tooltip content={t.title}>
                            <p className="font-medium text-[#272220] truncate">{t.title}</p>
                          </Tooltip>
                          {subtaskCount > 0 && (
                            <span className="text-[10px] font-medium text-[#A0A0A0] bg-slate-100 rounded-full px-1.5 py-0.5 shrink-0">
                              งานย่อย {subtaskCount}
                            </span>
                          )}
                        </div>
                        {parentTitle && (
                          <p className="text-[10px] text-[#A0A0A0] truncate">งานย่อยของ: {parentTitle}</p>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 pr-3">
                      {firstAssignee ? (
                        <span className="flex items-center gap-1.5 min-w-0">
                          {firstAssignee.avatar ? (
                            <img src={firstAssignee.avatar} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
                          ) : (
                            <span
                              className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                              style={{ backgroundColor: getAvatarColor(displayName(firstAssignee)) }}
                            >
                              {displayName(firstAssignee).trim().charAt(0).toUpperCase()}
                            </span>
                          )}
                          <span className="truncate text-xs text-[#272220]">
                            {displayName(firstAssignee)}{assignees.length > 1 ? ` +${assignees.length - 1}` : ''}
                          </span>
                        </span>
                      ) : (
                        <span className="text-xs text-[#A0A0A0]">ไม่ระบุ</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 whitespace-nowrap">
                      <p className="text-xs text-[#272220]">{t.dueDate ?? 'ไม่ระบุ'}</p>
                      {t.daysUntilDue !== undefined && (
                        <p className={`text-[10px] ${overdue ? 'text-[#FF2A04] font-semibold' : 'text-[#A0A0A0]'}`}>
                          {overdue ? 'เลยกำหนดแล้ว' : `อีก ${t.daysUntilDue} วัน`}
                        </p>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 whitespace-nowrap">
                      <span
                        className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium"
                        style={{ backgroundColor: `${color}1A`, color }}
                      >
                        {TASK_STATUS_LABEL[t.status]}
                      </span>
                    </td>
                    <td className="py-2.5">
                      <div className="flex justify-end">
                        <MiniProgressRing progress={t.progress} color={color} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
