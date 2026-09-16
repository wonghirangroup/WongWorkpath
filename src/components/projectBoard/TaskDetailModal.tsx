import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { X, Clock } from 'lucide-react';
import { Employee } from '../../types';
import { ProjectTaskItem } from './types';
import { TASK_STATUS_LABEL, TASK_STATUS_COLOR } from './statusMeta';
import { displayName, PRIORITY_OPTIONS } from './CreateProjectModal';
import { getAvatarColor } from '../../lib/avatarColor';
import { useEscapeToClose } from '../../lib/useEscapeToClose';

function PersonRow({ label, employee }: { label: string; employee: Employee | undefined }) {
  return (
    <div>
      <p className="text-[#A0A0A0] text-[11px] mb-1">{label}</p>
      {employee ? (
        <span className="flex items-center gap-2">
          {employee.avatar ? (
            <img src={employee.avatar} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
          ) : (
            <span
              className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
              style={{ backgroundColor: getAvatarColor(displayName(employee)) }}
            >
              {displayName(employee).trim().charAt(0).toUpperCase()}
            </span>
          )}
          <span className="text-sm text-[#272220]">{displayName(employee)}</span>
        </span>
      ) : (
        <span className="text-sm text-[#A0A0A0]">ยังไม่มี</span>
      )}
    </div>
  );
}

// Same shape as PersonRow, but for a field that can now hold more than one person (assignee(s),
// reviewer(s)) — stacks one avatar+name row per person instead of collapsing to a single value.
function PeopleRow({ label, employees }: { label: string; employees: Employee[] }) {
  return (
    <div>
      <p className="text-[#A0A0A0] text-[11px] mb-1">{label}</p>
      {employees.length > 0 ? (
        <div className="space-y-1.5">
          {employees.map((employee) => (
            <span key={employee.id} className="flex items-center gap-2">
              {employee.avatar ? (
                <img src={employee.avatar} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
              ) : (
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                  style={{ backgroundColor: getAvatarColor(displayName(employee)) }}
                >
                  {displayName(employee).trim().charAt(0).toUpperCase()}
                </span>
              )}
              <span className="text-sm text-[#272220]">{displayName(employee)}</span>
            </span>
          ))}
        </div>
      ) : (
        <span className="text-sm text-[#A0A0A0]">ยังไม่มี</span>
      )}
    </div>
  );
}

interface TaskDetailModalProps {
  task: ProjectTaskItem | null;
  employees: Employee[];
  onClose: () => void;
}

// Read-only — opened from the "การกระทำ" column's "ดูรายละเอียด" button so a truncated row
// (long description, etc.) can still be read in full without leaving the table.
export default function TaskDetailModal({ task, employees, onClose }: TaskDetailModalProps) {
  useEscapeToClose(Boolean(task), onClose);
  const assignees = task ? employees.filter((e) => task.assigneeEmployeeIds.includes(e.id)) : [];
  const creator = task?.creatorEmployeeId ? employees.find((e) => e.id === task.creatorEmployeeId) : undefined;
  const reviewers = task ? employees.filter((e) => (task.reviewerEmployeeIds ?? []).includes(e.id)) : [];
  const priorityMeta = task?.priority ? PRIORITY_OPTIONS.find((p) => p.value === task.priority) : undefined;
  const isUrgent = task?.daysUntilDue !== undefined && task.daysUntilDue <= 2;

  return createPortal(
    <AnimatePresence>
      {task && (
        <motion.div key="task-detail-modal" className="fixed inset-0 z-50 flex items-center justify-center">
          <motion.div
            className="absolute inset-0 bg-black/15 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24, mass: 0.9 }}
            className="relative bg-white rounded-2xl shadow-[0px_12px_36px_-8px_rgba(0,0,0,0.12)] w-full max-w-md mx-4 max-h-[85vh] overflow-y-auto"
          >
            <div className="flex justify-between items-start px-5 pt-5 pb-3 border-b border-slate-100">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0"
                    style={{ backgroundColor: `${TASK_STATUS_COLOR[task.status]}1A`, color: TASK_STATUS_COLOR[task.status] }}
                  >
                    {TASK_STATUS_LABEL[task.status]}
                  </span>
                  {isUrgent && (
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-red-50 text-[#F50C0C] flex items-center gap-1 shrink-0">
                      <Clock size={11} />
                      {task.daysUntilDue! < 0 ? 'เลยกำหนดแล้ว' : `เหลือ ${task.daysUntilDue} วัน`}
                    </span>
                  )}
                </div>
                <h3 className="text-base font-bold text-slate-800 mt-2 break-words">{task.title}</h3>
              </div>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer shrink-0" type="button">
                <X size={18} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              {task.description && (
                <div>
                  <p className="text-[#A0A0A0] text-[11px] mb-1">รายละเอียด</p>
                  <p className="text-sm text-[#272220] whitespace-pre-wrap break-words">{task.description}</p>
                </div>
              )}

              <div>
                <p className="text-[#A0A0A0] text-[11px] mb-1">ความคืบหน้า</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-[#F0F0F0] overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${task.progress}%`, backgroundColor: TASK_STATUS_COLOR[task.status] }} />
                  </div>
                  <span className="text-xs font-medium shrink-0" style={{ color: TASK_STATUS_COLOR[task.status] }}>{task.progress}%</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <PeopleRow label="ผู้รับผิดชอบ" employees={assignees} />
                <PersonRow label="ผู้สร้าง" employee={creator} />
              </div>

              {reviewers.length > 0 && (
                <div className="grid grid-cols-2 gap-4">
                  <PeopleRow label="ผู้ตรวจงาน" employees={reviewers} />
                </div>
              )}

              {task.status === 'in_progress' && task.reviewNote && (
                <div>
                  <p className="text-[#A0A0A0] text-[11px] mb-1">เหตุผลที่ถูกตีกลับ</p>
                  <p className="text-sm text-red-600 whitespace-pre-wrap break-words bg-red-50 border border-red-100 rounded-lg px-3 py-2">{task.reviewNote}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[#A0A0A0] text-[11px] mb-1">ระยะเวลา</p>
                  <p className="text-sm text-[#272220]">
                    {task.startDate ? `${task.startDate} — ${task.dueDate ?? 'ยังไม่มี'}` : task.dueDate ?? 'ยังไม่มี'}
                  </p>
                </div>
                <div>
                  <p className="text-[#A0A0A0] text-[11px] mb-1">ความสำคัญ</p>
                  {priorityMeta ? (
                    <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-medium border ${priorityMeta.activeClass}`}>
                      {priorityMeta.label}
                    </span>
                  ) : (
                    <span className="text-sm text-[#A0A0A0]">ยังไม่มี</span>
                  )}
                </div>
              </div>

              {task.checklist.length > 0 && (
                <div>
                  <p className="text-[#A0A0A0] text-[11px] mb-1.5">งานย่อย</p>
                  <div className="space-y-1.5">
                    {task.checklist.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        <span
                          className={`w-4 h-4 rounded shrink-0 flex items-center justify-center ${item.done ? 'bg-[#197A4B]' : 'border border-slate-300'}`}
                        >
                          {item.done && <span className="text-white text-[10px]">✓</span>}
                        </span>
                        <span className={item.done ? 'text-[#A0A0A0] line-through' : 'text-[#272220]'}>{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="px-5 pb-5">
              <button
                type="button"
                onClick={onClose}
                className="w-full h-10 text-sm font-semibold text-[#6F6F6F] hover:bg-slate-50 rounded-lg border border-[#E5E5E5] cursor-pointer"
              >
                ปิด
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
