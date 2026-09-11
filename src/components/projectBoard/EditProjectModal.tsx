import { useState, FormEvent, KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { X, ArrowRight } from 'lucide-react';
import { Employee } from '../../types';
import { ProjectRow, ProjectStatus } from './types';
import { STATUS_LABEL } from './statusMeta';
import {
  EmployeeSearchSelect,
  PRIORITY_OPTIONS,
  PRIORITY_TO_ROW,
  ROW_TO_PRIORITY,
  Priority,
  STATUS_OPTIONS,
} from './CreateProjectModal';
import { ApiError } from '../../lib/api';

interface EditProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  row: ProjectRow;
  employees: Employee[];
  onSave: (updates: Partial<ProjectRow>) => Promise<void>;
}

// Single-screen edit form (not the create wizard's 3 steps) — editing an existing project should
// show every field at once rather than re-running a step-by-step flow each time. Only fields the
// create wizard itself collects are editable here (see CreateProjectModal's own note on why
// "department" has no field yet) — this stays a straight edit of what's already there.
export default function EditProjectModal({ isOpen, onClose, row, employees, onSave }: EditProjectModalProps) {
  const [title, setTitle] = useState(row.title);
  const [description, setDescription] = useState(row.description ?? '');
  const [ownerId, setOwnerId] = useState(row.ownerEmployeeId ?? '');
  const [priority, setPriority] = useState<Priority | null>(row.priority ? ROW_TO_PRIORITY[row.priority] : null);
  const [status, setStatus] = useState<ProjectStatus>(row.status);
  const [startDate, setStartDate] = useState(row.startDateISO ?? '');
  const [endDate, setEndDate] = useState(row.endDateISO ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const titleValid = title.trim() !== '';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!titleValid || isSubmitting) return;
    setFormError('');
    setIsSubmitting(true);
    try {
      await onSave({
        title: title.trim(),
        description: description.trim() || undefined,
        priority: priority ? PRIORITY_TO_ROW[priority] : undefined,
        ownerEmployeeId: ownerId || null,
        status,
        startDate: startDate || null,
        endDate: endDate || null,
      });
      onClose();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'บันทึกการแก้ไขไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Plain Enter submits (matching CreateProjectModal's wizard-advance convention) — Shift+Enter
  // in the description textarea still inserts a newline as usual. Single-line inputs already
  // submit natively on Enter, so only the textarea case needs an explicit form.requestSubmit().
  const handleFormKeyDown = (e: KeyboardEvent<HTMLFormElement>) => {
    if (e.key !== 'Enter') return;
    const isTextarea = (e.target as HTMLElement).tagName === 'TEXTAREA';
    if (isTextarea && e.shiftKey) return;
    if (isTextarea) {
      e.preventDefault();
      e.currentTarget.requestSubmit();
    }
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div key="edit-project-modal" className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Only the X button closes this, same as CreateProjectModal — an accidental click
              outside shouldn't discard in-progress edits. */}
          <motion.div
            className="absolute inset-0 bg-black/15 backdrop-blur-sm"
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
            className="relative bg-white rounded-2xl shadow-[0px_12px_36px_-8px_rgba(0,0,0,0.12)] w-full max-w-md mx-4 max-h-[85vh] overflow-hidden flex flex-col"
          >
            <div className="flex justify-between items-center px-5 pt-5 pb-3 shrink-0 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-800">แก้ไขโครงการ</h3>
                  <span className="text-[10px] font-bold text-[#FF6537] bg-[#FFF1EC] px-2 py-0.5 rounded-full">{row.code}</span>
                </div>
                <p className="text-[11px] text-[#6F6F6F] mt-0.5">ปรับข้อมูลโครงการแล้วกดบันทึกเพื่อยืนยัน</p>
              </div>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer" type="button">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 min-h-0 overflow-y-auto px-5 pt-4 pb-1 space-y-3">
                <div>
                  <label className="block text-[#272220] font-bold text-[11px] mb-1">
                    ชื่อโครงการ <span className="text-[#FF6537]">*</span>
                  </label>
                  <input
                    type="text"
                    autoFocus
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full p-2.5 text-sm border border-[#E5E5E5] rounded-lg placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#FF6537]"
                  />
                </div>

                <div>
                  <label className="block text-[#272220] font-bold text-[11px] mb-1">รายละเอียด</label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full p-2.5 text-sm border border-[#E5E5E5] rounded-lg placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#FF6537]"
                  />
                </div>

                <div>
                  <label className="block text-[#272220] font-bold text-[11px] mb-1">ผู้รับผิดชอบหลัก</label>
                  <EmployeeSearchSelect
                    employees={employees}
                    valueId={ownerId}
                    onChange={setOwnerId}
                    placeholder="ค้นหาหรือเลือกพนักงาน..."
                  />
                </div>

                <div>
                  <label className="block text-[#272220] font-bold text-[11px] mb-1">ระดับความสำคัญ</label>
                  <div className="flex gap-2">
                    {PRIORITY_OPTIONS.map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setPriority((current) => (current === p.value ? null : p.value))}
                        className={`flex-1 h-9 rounded-lg text-xs font-semibold border cursor-pointer transition-colors ${
                          priority === p.value ? p.activeClass : 'border-[#E5E5E5] text-[#6F6F6F] hover:bg-slate-50'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[#272220] font-bold text-[11px] mb-1">สถานะ</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                    className="w-full p-2.5 text-sm border border-[#E5E5E5] rounded-lg bg-white focus:outline-none focus:border-[#FF6537]"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[#272220] font-bold text-[11px] mb-1">วันที่เริ่ม</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full p-2.5 text-sm border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#FF6537]"
                    />
                  </div>
                  <div>
                    <label className="block text-[#272220] font-bold text-[11px] mb-1">วันที่สิ้นสุด</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full p-2.5 text-sm border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#FF6537]"
                    />
                  </div>
                </div>

                {formError && (
                  <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{formError}</p>
                )}
              </div>

              <div className="shrink-0 px-5 pt-4 pb-5 flex items-center gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 h-10 text-sm font-semibold text-[#6F6F6F] hover:bg-slate-50 rounded-lg border border-[#E5E5E5] cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={!titleValid || isSubmitting}
                  className={`flex-1 h-10 flex items-center justify-center gap-1.5 text-white font-bold text-sm rounded-lg transition-colors ${
                    titleValid && !isSubmitting ? 'bg-[#FF6537] hover:bg-[#e6572c] cursor-pointer' : 'bg-[#F68C6C] cursor-not-allowed'
                  }`}
                >
                  {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
                  {!isSubmitting && <ArrowRight size={16} />}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
