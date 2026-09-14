import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { X, FileText, Download, User } from 'lucide-react';
import { Employee, LinkedDoc } from '../../types';
import { ProjectTaskItem } from './types';
import { displayName } from './CreateProjectModal';
import { getAvatarColor } from '../../lib/avatarColor';

interface ReviewTaskModalProps {
  task: ProjectTaskItem | null;
  employees: Employee[];
  documents: LinkedDoc[];
  onReview: (taskId: string, updates: Partial<ProjectTaskItem>) => Promise<void>;
  onClose: () => void;
}

// The other half of SubmitTaskModal's loop: the reviewer reads the submission note + attached
// files, then either passes it (-> 'done') or bounces it back (-> 'in_progress' with a required
// reason in reviewNote, which the assignee sees on the task and can address before resubmitting).
export default function ReviewTaskModal({ task, employees, documents, onReview, onClose }: ReviewTaskModalProps) {
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectField, setShowRejectField] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!task) return;
    setRejectReason('');
    setShowRejectField(false);
    setFormError('');
  }, [task]);

  if (!task) return null;

  const assignees = employees.filter((e) => task.assigneeEmployeeIds.includes(e.id));
  const submissionFiles = (task.submissionFileIds ?? [])
    .map((id) => documents.find((d) => d.id === id))
    .filter((d): d is LinkedDoc => Boolean(d));

  const handlePass = async () => {
    if (isSubmitting) return;
    setFormError('');
    setIsSubmitting(true);
    try {
      await onReview(task.id, { status: 'done', progress: 100, reviewNote: '' });
      onClose();
    } catch {
      setFormError('บันทึกผลตรวจไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (isSubmitting || !rejectReason.trim()) return;
    setFormError('');
    setIsSubmitting(true);
    try {
      await onReview(task.id, { status: 'in_progress', reviewNote: rejectReason.trim() });
      onClose();
    } catch {
      setFormError('บันทึกผลตรวจไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <AnimatePresence>
      {task && (
        <motion.div key="review-task-modal" className="fixed inset-0 z-50 flex items-center justify-center">
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
            className="relative bg-white rounded-2xl shadow-[0px_12px_36px_-8px_rgba(0,0,0,0.12)] w-full max-w-md mx-4 max-h-[85vh] overflow-hidden flex flex-col"
          >
            <div className="flex justify-between items-center px-5 pt-5 pb-2 shrink-0">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-800">ตรวจงาน</h3>
                <p className="text-[11px] text-[#6F6F6F] mt-0.5 truncate">{task.title}</p>
              </div>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer shrink-0" type="button">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-5 pt-4 pb-1 space-y-3">
              <div>
                <p className="text-[#A0A0A0] text-[11px] mb-1">ผู้ส่งงาน</p>
                {assignees.length > 0 ? (
                  <div className="space-y-1.5">
                    {assignees.map((assignee) => (
                      <span key={assignee.id} className="flex items-center gap-2">
                        {assignee.avatar ? (
                          <img src={assignee.avatar} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
                        ) : (
                          <span
                            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                            style={{ backgroundColor: getAvatarColor(displayName(assignee)) }}
                          >
                            {displayName(assignee).trim().charAt(0).toUpperCase()}
                          </span>
                        )}
                        <span className="text-sm text-[#272220]">{displayName(assignee)}</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="flex items-center gap-1.5 text-sm text-[#A0A0A0]"><User size={14} /> ไม่ทราบผู้ส่งงาน</span>
                )}
              </div>

              <div>
                <p className="text-[#A0A0A0] text-[11px] mb-1">บันทึกจากผู้ส่งงาน</p>
                <p className="text-sm text-[#272220] whitespace-pre-wrap break-words">
                  {task.submissionNote || 'ไม่มีบันทึกเพิ่มเติม'}
                </p>
              </div>

              {submissionFiles.length > 0 && (
                <div>
                  <p className="text-[#A0A0A0] text-[11px] mb-1.5">ไฟล์แนบ ({submissionFiles.length})</p>
                  <div className="space-y-1.5">
                    {submissionFiles.map((doc) => (
                      <a
                        key={doc.id}
                        href={doc.fileDataUrl}
                        download={doc.name}
                        className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-xs transition-colors"
                      >
                        <FileText size={14} className="text-[#6F6F6F] shrink-0" />
                        <span className="truncate flex-1 text-[#272220]">{doc.name}</span>
                        <Download size={13} className="text-[#A0A0A0] shrink-0" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {showRejectField && (
                <div className="border-t border-slate-100 pt-3">
                  <label className="block text-[#272220] font-bold text-[11px] mb-1">
                    เหตุผลที่ตีกลับ <span className="text-[#FF6537]">*</span>
                  </label>
                  <textarea
                    rows={3}
                    autoFocus
                    placeholder="บอกผู้ส่งงานว่าต้องแก้ไขอะไร..."
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    className="w-full p-2.5 text-sm border border-red-300 rounded-lg placeholder:text-[#B0B0B0] focus:outline-none focus:border-red-500"
                  />
                </div>
              )}

              {formError && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{formError}</p>
              )}
            </div>

            <div className="shrink-0 px-5 pt-4 pb-5 flex items-center gap-3">
              {!showRejectField ? (
                <>
                  <button
                    type="button"
                    onClick={() => setShowRejectField(true)}
                    disabled={isSubmitting}
                    className="px-4 h-10 text-sm font-semibold text-red-600 hover:bg-red-50 rounded-lg border border-red-200 cursor-pointer"
                  >
                    ตีกลับ
                  </button>
                  <button
                    type="button"
                    onClick={handlePass}
                    disabled={isSubmitting}
                    className="flex-1 h-10 text-white font-bold text-sm rounded-lg bg-[#197A4B] hover:bg-[#146339] cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'กำลังบันทึก...' : 'ผ่าน'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setShowRejectField(false)}
                    disabled={isSubmitting}
                    className="px-4 h-10 text-sm font-semibold text-[#6F6F6F] hover:bg-slate-50 rounded-lg border border-[#E5E5E5] cursor-pointer"
                  >
                    ย้อนกลับ
                  </button>
                  <button
                    type="button"
                    onClick={handleReject}
                    disabled={isSubmitting || !rejectReason.trim()}
                    className={`flex-1 h-10 text-white font-bold text-sm rounded-lg transition-colors ${
                      rejectReason.trim() && !isSubmitting ? 'bg-red-600 hover:bg-red-700 cursor-pointer' : 'bg-red-300 cursor-not-allowed'
                    }`}
                  >
                    {isSubmitting ? 'กำลังบันทึก...' : 'ยืนยันตีกลับ'}
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
