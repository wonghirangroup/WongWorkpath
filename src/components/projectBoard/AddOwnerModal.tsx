import { useState, useEffect, FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { X, Users2 } from 'lucide-react';
import { Employee } from '../../types';
import { EmployeeMultiSelect, displayName } from './CreateProjectModal';
import { ApiError, ChangeRequest } from '../../lib/api';
import { isOwner, resolveValidIds } from '../../lib/ownership';
import { useEscapeToClose } from '../../lib/useEscapeToClose';

interface AddOwnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectTitle: string;
  currentOwnerIds: string[];
  employees: Employee[];
  currentUserId: string;
  isExecutive: boolean;
  changeRequests: ChangeRequest[];
  onSave: (ownerEmployeeIds: string[]) => Promise<void>;
  onRequestChange: (
    entityType: 'project' | 'project_task',
    entityId: string,
    requestType: 'edit' | 'delete',
    proposedChanges: Record<string, unknown> | undefined,
    reason: string
  ) => Promise<void>;
}

// Quick one-field shortcut for adding to a project's ผู้รับผิดชอบหลัก without opening the full
// "แก้ไขโครงการ" form — same direct-save-vs-request-approval branching EditProjectModal uses: an
// existing owner (or ผู้บริหาร) saves straight away, anyone else needs a reason and goes through
// the same change-request flow. An unowned project stays open to everyone (resolveValidIds also
// drops any dangling owner id pointing at a deleted employee, same as elsewhere).
export default function AddOwnerModal({ isOpen, onClose, projectId, projectTitle, currentOwnerIds, employees, currentUserId, isExecutive, changeRequests, onSave, onRequestChange }: AddOwnerModalProps) {
  useEscapeToClose(isOpen, onClose);
  const canEditDirectly = isExecutive || isOwner(resolveValidIds(currentOwnerIds, employees), currentUserId);
  const pendingRequest = changeRequests.find(
    (r) => r.entityType === 'project' && r.entityId === projectId && r.status === 'pending'
  );
  const [ownerIds, setOwnerIds] = useState<string[]>(currentOwnerIds);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Re-sync from the project's current owners each time the modal opens, so a stale selection
  // from a previous open (or owners changed elsewhere since) never gets shown.
  useEffect(() => {
    if (isOpen) {
      setOwnerIds(currentOwnerIds);
      setReason('');
      setFormError('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const reasonValid = canEditDirectly || reason.trim() !== '';
  const isValid = ownerIds.length > 0 && reasonValid;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isValid || isSubmitting || pendingRequest) return;
    setFormError('');
    setIsSubmitting(true);
    try {
      if (canEditDirectly) {
        await onSave(ownerIds);
      } else {
        await onRequestChange('project', projectId, 'edit', { ownerEmployeeIds: ownerIds }, reason.trim());
      }
      onClose();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'เพิ่มผู้รับผิดชอบหลักไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div key="add-owner-modal" className="fixed inset-0 z-50 flex items-center justify-center">
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
            className="relative bg-white rounded-2xl shadow-[0px_12px_36px_-8px_rgba(0,0,0,0.12)] w-full max-w-sm mx-4 overflow-hidden flex flex-col"
          >
            <div className="flex justify-between items-center px-5 pt-5 pb-2 shrink-0">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <Users2 size={15} className="text-[#FF6537]" /> เพิ่มผู้รับผิดชอบหลัก
                </h3>
                <p className="text-[11px] text-[#6F6F6F] mt-0.5 truncate">{projectTitle}</p>
              </div>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer shrink-0" type="button">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-5 pt-3 pb-5 space-y-3">
              <div>
                <div className="flex items-baseline justify-between mb-1">
                  <label className="block text-[#272220] font-bold text-[11px]">
                    ผู้รับผิดชอบหลัก <span className="text-[#FF6537]">*</span>
                  </label>
                  <span className="text-[10px] text-[#6F6F6F]">เลือกได้หลายคน สิทธิ์เท่ากันทุกคน</span>
                </div>
                <EmployeeMultiSelect
                  employees={employees}
                  valueIds={ownerIds}
                  onChange={setOwnerIds}
                  placeholder="ค้นหาแล้วเลือกเพิ่มได้หลายคน..."
                />
              </div>

              {pendingRequest ? (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  มีคำขอแก้ไขรออนุมัติอยู่แล้ว โดย {(() => {
                    const requester = employees.find((e) => e.id === pendingRequest.requestedBy);
                    return requester ? displayName(requester) : 'ไม่ทราบผู้ใช้งาน';
                  })()}
                  {' — เหตุผล: '}{pendingRequest.reason}
                </p>
              ) : !canEditDirectly && (
                <div>
                  <label className="block text-[#272220] font-bold text-[11px] mb-1">
                    เหตุผลที่ขอเพิ่ม <span className="text-[#FF6537]">*</span>
                  </label>
                  <textarea
                    rows={2}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="โครงการนี้มีผู้รับผิดชอบหลักแล้ว ระบุเหตุผลเพื่อขออนุมัติเพิ่ม..."
                    className="w-full p-2.5 text-sm border border-[#E5E5E5] rounded-lg placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#FF6537]"
                  />
                </div>
              )}

              {formError && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{formError}</p>
              )}

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 h-10 text-sm font-semibold text-[#6F6F6F] hover:bg-slate-50 rounded-lg border border-[#E5E5E5] cursor-pointer"
                >
                  ยกเลิก
                </button>
                {!pendingRequest && (
                  <button
                    type="submit"
                    disabled={!isValid || isSubmitting}
                    className={`flex-1 h-10 text-white font-bold text-sm rounded-lg transition-colors ${
                      isValid && !isSubmitting ? 'bg-[#FF6537] hover:bg-[#e6572c] cursor-pointer' : 'bg-[#F68C6C] cursor-not-allowed'
                    }`}
                  >
                    {isSubmitting ? (canEditDirectly ? 'กำลังบันทึก...' : 'กำลังส่งคำขอ...') : canEditDirectly ? 'บันทึก' : 'ส่งคำขออนุมัติ'}
                  </button>
                )}
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
