import { useState, useEffect, FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { X, Users2 } from 'lucide-react';
import { Employee } from '../../types';
import { EmployeeMultiSelect, displayName } from './CreateProjectModal';
import { ApiError, ChangeRequest } from '../../lib/api';
import { isOwner, resolveValidIds } from '../../lib/ownership';
import { useEscapeToClose } from '../../lib/useEscapeToClose';
import { useConfirm } from '../../context/ConfirmContext';
import Tooltip from '../Tooltip';

export interface ResponsibleUpdates {
  ownerEmployeeIds: string[];
  memberEmployeeIds: string[];
  memberDuties: Record<string, string>;
}

interface AddResponsibleModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectTitle: string;
  currentOwnerIds: string[];
  currentMemberIds: string[];
  currentMemberDuties: Record<string, string>;
  employees: Employee[];
  currentUserId: string;
  isExecutive: boolean;
  changeRequests: ChangeRequest[];
  onSave: (updates: ResponsibleUpdates) => Promise<void>;
  onRequestChange: (
    entityType: 'project' | 'project_task',
    entityId: string,
    requestType: 'edit' | 'delete',
    proposedChanges: Record<string, unknown> | undefined,
    reason: string
  ) => Promise<void>;
}

const sameIds = (a: string[], b: string[]) => a.length === b.length && a.every((id) => b.includes(id));

// Quick shortcut for adding people to a project — both ผู้รับผิดชอบหลัก (owners, who approve
// changes) and ผู้รับผิดชอบร่วม (members) — without opening the full "แก้ไขโครงการ" form. Same
// direct-save-vs-request-approval branching EditProjectModal uses: an existing owner (or ผู้บริหาร)
// saves straight away, anyone else needs a reason and goes through the same change-request flow. An
// unowned project stays open to everyone (resolveValidIds also drops any dangling owner id pointing
// at a deleted employee, same as elsewhere). Someone can't be both at once: picking a person as
// หลัก moves them out of ร่วม.
export default function AddResponsibleModal({
  isOpen, onClose, projectId, projectTitle, currentOwnerIds, currentMemberIds, currentMemberDuties,
  employees, currentUserId, isExecutive, changeRequests, onSave, onRequestChange,
}: AddResponsibleModalProps) {
  useEscapeToClose(isOpen, onClose);
  const confirm = useConfirm();
  const canEditDirectly = isExecutive || isOwner(resolveValidIds(currentOwnerIds, employees), currentUserId);
  const pendingRequest = changeRequests.find(
    (r) => r.entityType === 'project' && r.entityId === projectId && r.status === 'pending'
  );
  const [ownerIds, setOwnerIds] = useState<string[]>(currentOwnerIds);
  const [memberIds, setMemberIds] = useState<string[]>(currentMemberIds);
  const [memberDuties, setMemberDuties] = useState<Record<string, string>>(currentMemberDuties);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Re-sync from the project's current people each time the modal opens, so a stale selection from
  // a previous open (or people changed elsewhere since) never gets shown.
  useEffect(() => {
    if (isOpen) {
      setOwnerIds(currentOwnerIds);
      setMemberIds(currentMemberIds);
      setMemberDuties(currentMemberDuties);
      setReason('');
      setFormError('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleOwnersChange = (ids: string[]) => {
    setOwnerIds(ids);
    setMemberIds((prev) => prev.filter((id) => !ids.includes(id)));
  };

  const memberEmps = employees.filter((e) => memberIds.includes(e.id));

  const isChanged = !sameIds(ownerIds, currentOwnerIds) || !sameIds(memberIds, currentMemberIds)
    || memberIds.some((id) => (memberDuties[id] ?? '') !== (currentMemberDuties[id] ?? ''));
  const reasonValid = canEditDirectly || reason.trim() !== '';
  const isValid = isChanged && reasonValid;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isValid || isSubmitting || pendingRequest) return;
    const summary = `ผู้รับผิดชอบหลัก ${ownerIds.length} คน, ผู้รับผิดชอบร่วม ${memberIds.length} คน`;
    const confirmed = await confirm({
      title: canEditDirectly ? 'ยืนยันการเพิ่มผู้รับผิดชอบ?' : 'ยืนยันการส่งคำขอเพิ่มผู้รับผิดชอบ?',
      message: canEditDirectly
        ? `บันทึกผู้รับผิดชอบของโครงการ "${projectTitle}" — ${summary}`
        : `ส่งคำขอให้ผู้รับผิดชอบหลักของโครงการ "${projectTitle}" พิจารณา — ${summary}`,
      confirmLabel: canEditDirectly ? 'บันทึก' : 'ส่งคำขอ',
    });
    if (!confirmed) return;
    setFormError('');
    setIsSubmitting(true);
    // A removed member's duty text would otherwise linger in the row, so only keep duties for
    // people who are still members.
    const updates: ResponsibleUpdates = {
      ownerEmployeeIds: ownerIds,
      memberEmployeeIds: memberIds,
      memberDuties: Object.fromEntries(
        Object.entries(memberDuties).filter(([id, duty]) => memberIds.includes(id) && duty.trim() !== '')
      ),
    };
    try {
      if (canEditDirectly) {
        await onSave(updates);
      } else {
        await onRequestChange('project', projectId, 'edit', { ...updates }, reason.trim());
      }
      onClose();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'เพิ่มผู้รับผิดชอบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div key="add-responsible-modal" className="fixed inset-0 z-50 flex items-center justify-center">
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
            role="dialog" aria-modal="true" aria-label="เพิ่มผู้รับผิดชอบ" className="relative bg-white rounded-2xl shadow-[0px_12px_36px_-8px_rgba(0,0,0,0.12)] w-full max-w-md mx-4 overflow-hidden flex flex-col"
          >
            <div className="flex justify-between items-center px-5 pt-5 pb-2 shrink-0">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <Users2 size={15} className="text-[#FF6537]" /> เพิ่มผู้รับผิดชอบ
                </h3>
                <p className="text-[11px] text-[#6F6F6F] mt-0.5 truncate">{projectTitle}</p>
              </div>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer shrink-0" type="button" aria-label="ปิด">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-5 pt-3 pb-5 space-y-3">
              <div>
                <div className="flex items-baseline justify-between mb-1">
                  <label className="block text-[#272220] font-bold text-[11px]">ผู้รับผิดชอบหลัก</label>
                  <span className="text-[11px] text-[#6F6F6F]">เลือกได้หลายคน สิทธิ์เท่ากันทุกคน</span>
                </div>
                <EmployeeMultiSelect
                  employees={employees.filter((emp) => !memberIds.includes(emp.id))}
                  valueIds={ownerIds}
                  onChange={handleOwnersChange}
                  placeholder="ค้นหาแล้วเลือกเพิ่มได้หลายคน..."
                />
              </div>

              <div>
                <label className="block text-[#272220] font-bold text-[11px] mb-1">ผู้รับผิดชอบร่วม</label>
                <EmployeeMultiSelect
                  employees={employees.filter((emp) => !ownerIds.includes(emp.id))}
                  valueIds={memberIds}
                  onChange={setMemberIds}
                  placeholder="ค้นหาแล้วเลือกเพิ่มได้หลายคน..."
                />
                {memberEmps.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {memberEmps.map((emp) => (
                      <div key={emp.id} className="flex items-center gap-2">
                        <Tooltip content={displayName(emp)}>
                          <span className="text-[11px] text-[#6F6F6F] w-20 truncate shrink-0">
                            {displayName(emp)}
                          </span>
                        </Tooltip>
                        <input
                          type="text"
                          placeholder="หน้าที่ในโครงการนี้..."
                          value={memberDuties[emp.id] ?? ''}
                          onChange={(e) => setMemberDuties((prev) => ({ ...prev, [emp.id]: e.target.value }))}
                          className="flex-1 p-1.5 text-xs border border-[#E5E5E5] rounded-lg placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#FF6537]"
                        />
                      </div>
                    ))}
                  </div>
                )}
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
