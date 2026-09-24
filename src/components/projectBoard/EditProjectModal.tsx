import { useState, FormEvent, KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { X, ArrowRight } from 'lucide-react';
import { useEscapeToClose } from '../../lib/useEscapeToClose';
import ThaiDatePicker from '../ThaiDatePicker';
import { Employee } from '../../types';
import { ProjectRow, CustomProjectStatus, CustomProjectType } from './types';
import { STATUS_LABEL, PROJECT_TYPE_META, PROJECT_TYPE_OPTIONS } from './statusMeta';
import {
  EmployeeMultiSelect,
  PRIORITY_OPTIONS,
  Priority,
  STATUS_OPTIONS,
  getUniqueTitle,
  displayName,
} from './CreateProjectModal';
import { ApiError, ChangeRequest } from '../../lib/api';
import { formatThousands } from '../../lib/numberFormat';
import { isOwner, resolveValidIds } from '../../lib/ownership';
import { useConfirm } from '../../context/ConfirmContext';
import Dropdown from '../Dropdown';
import Tooltip from '../Tooltip';
import DeadlineReminderField, { useSavedReminder } from '../DeadlineReminderField';
import { reminderLimit } from '../../lib/deadlineReminders';

interface EditProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  row: ProjectRow;
  employees: Employee[];
  onSave: (updates: Partial<ProjectRow>) => Promise<void>;
  existingTitles: string[];
  customStatuses: CustomProjectStatus[];
  customTypes: CustomProjectType[];
  // For the "โครงการหลัก" picker, offered only when type === 'SP' — same as CreateProjectModal's
  // own use of this list.
  projects: ProjectRow[];
  currentUserId: string;
  // ผู้บริหาร bypasses the owner-approval gate regardless of whether they're actually an
  // owner of this project.
  isExecutive: boolean;
  changeRequests: ChangeRequest[];
  onRequestChange: (
    entityType: 'project' | 'project_task',
    entityId: string,
    requestType: 'edit' | 'delete',
    proposedChanges: Record<string, unknown> | undefined,
    reason: string
  ) => Promise<void>;
}

const inputClass = 'w-full p-2.5 text-sm border border-[#E5E5E5] rounded-lg placeholder:text-[#767676] focus:outline-none focus:border-[#FF6537]';

// Single-screen edit form (not the create wizard's 3 steps) — editing an existing project should
// show every field at once rather than re-running a step-by-step flow each time. Only fields the
// create wizard itself collects are editable here (see CreateProjectModal's own note on why
// "department" has no field yet) — this stays a straight edit of what's already there.
//
// On a wide screen the fields sit in two columns — the project's own details on the left, its people,
// budget and dates on the right — so the whole form fits without scrolling (same treatment as
// AddTaskModal and CreateProjectModal). Below `lg` it stacks into one scrolling column as before.
export default function EditProjectModal({ isOpen, onClose, row, employees, onSave, existingTitles, customStatuses, customTypes, projects, currentUserId, isExecutive, changeRequests, onRequestChange }: EditProjectModalProps) {
  useEscapeToClose(isOpen, onClose);
  const confirm = useConfirm();
  // Once row.ownerEmployeeIds has ≥1 person, only they may save directly — anyone else's submit
  // files a change_request instead (see ProjectDetail's "คำขอที่รอดำเนินการ" panel for the
  // owner-facing approve/reject side). An unowned project stays open to everyone, as today —
  // resolveValidIds also treats an owner who's since been deleted as "no owner", same as the UI's
  // own "ยังไม่มี" display already does, so a dangling reference can't permanently lock a project.
  // ผู้บริหาร always saves directly.
  const canEditDirectly = isExecutive || isOwner(resolveValidIds(row.ownerEmployeeIds, employees), currentUserId);
  const pendingRequest = changeRequests.find(
    (r) => r.entityType === 'project' && r.entityId === row.id && r.status === 'pending'
  );
  const [reason, setReason] = useState('');
  const [title, setTitle] = useState(row.title);
  const [renameNotice, setRenameNotice] = useState('');
  // Renaming to the project's own current title is never a "collision" with itself.
  const otherTitles = existingTitles.filter((t) => t.trim().toLowerCase() !== row.title.trim().toLowerCase());
  const [description, setDescription] = useState(row.description ?? '');
  const [type, setType] = useState<string | null>(row.type ?? null);
  const [parentProjectId, setParentProjectId] = useState<string | null>(row.parentProjectId ?? null);
  const isSubProject = type === 'SP';
  const topLevelProjects = projects.filter((p) => p.type === 'P' && p.id !== row.id);
  const [abbreviation, setAbbreviation] = useState(row.abbreviation ?? '');
  const [ownerIds, setOwnerIds] = useState<string[]>(row.ownerEmployeeIds ?? []);
  const [memberIds, setMemberIds] = useState<string[]>(row.memberEmployeeIds ?? []);
  // Someone can't be both at once — matches AddResponsibleModal's own handleOwnersChange. The
  // pickers below also each exclude the other list's current people, so this mostly guards
  // against a stale/racy value already in state; the two together keep the two lists disjoint.
  const handleOwnersChange = (ids: string[]) => {
    setOwnerIds(ids);
    setMemberIds((prev) => prev.filter((id) => !ids.includes(id)));
  };
  const [memberDuties, setMemberDuties] = useState<Record<string, string>>(row.memberDuties ?? {});
  const [priority, setPriority] = useState<Priority | null>(row.priority ?? null);
  const [status, setStatus] = useState<string>(row.status);
  const [budget, setBudget] = useState(row.budget !== null ? String(row.budget) : '');
  const [startDate, setStartDate] = useState(row.startDateISO ?? '');
  const [endDate, setEndDate] = useState(row.endDateISO ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const titleValid = title.trim() !== '';
  const dateOrderValid = !(startDate && endDate && endDate < startDate);
  const reasonValid = canEditDirectly || reason.trim() !== '';
  const parentValid = !isSubProject || parentProjectId !== null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!titleValid || !dateOrderValid || !reasonValid || !parentValid || isSubmitting || pendingRequest) return;
    const confirmed = await confirm({
      title: canEditDirectly ? 'ยืนยันการบันทึกการแก้ไขโครงการ?' : 'ยืนยันการส่งคำขอแก้ไขโครงการ?',
      message: canEditDirectly ? `บันทึกการแก้ไขของโครงการ "${row.title}"` : `ส่งคำขอแก้ไขโครงการ "${row.title}" ให้ผู้รับผิดชอบหลักพิจารณา`,
      confirmLabel: canEditDirectly ? 'บันทึก' : 'ส่งคำขอ',
    });
    if (!confirmed) return;
    setFormError('');
    setIsSubmitting(true);
    // Safety net alongside the title field's own onBlur (see CreateProjectModal's identical note).
    const finalTitle = getUniqueTitle(title, otherTitles);
    const updates = {
      title: finalTitle,
      description: description.trim() || undefined,
      type: type ?? undefined,
      abbreviation: abbreviation.trim() || undefined,
      parentProjectId: isSubProject ? parentProjectId ?? undefined : undefined,
      priority: priority ?? undefined,
      ownerEmployeeIds: ownerIds,
      memberEmployeeIds: memberIds,
      memberDuties: Object.fromEntries(
        Object.entries(memberDuties).filter(([id, duty]) => memberIds.includes(id) && duty.trim() !== '')
      ),
      status,
      budget: budget.trim() !== '' && !isNaN(Number(budget)) ? Number(budget) : null,
      startDate: startDate || null,
      endDate: endDate || null,
    };
    try {
      if (canEditDirectly) {
        await onSave(updates);
      } else {
        await onRequestChange('project', row.id, 'edit', updates, reason.trim());
      }
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

  const chosenMembers = employees.filter((e) => memberIds.includes(e.id));
  // My own reminder for this project's end date — saved immediately, never part of the edit/approval flow.
  const savedReminder = useSavedReminder('project', row.id);

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
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-project-title"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24, mass: 0.9 }}
            className="relative bg-white rounded-2xl shadow-[0px_12px_36px_-8px_rgba(0,0,0,0.12)] w-full max-w-lg lg:max-w-5xl mx-4 max-h-[94vh] overflow-hidden flex flex-col"
          >
            <div className="flex justify-between items-center px-5 pt-5 pb-3 shrink-0 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <h3 id="edit-project-title" className="text-sm font-bold text-slate-800">แก้ไขโครงการ</h3>
                  <span className="text-[11px] font-bold text-[#FF6537] bg-[#FFF1EC] px-2 py-0.5 rounded-full">{row.code}</span>
                </div>
                <p className="text-[11px] text-[#6F6F6F] mt-0.5">ปรับข้อมูลโครงการแล้วกดบันทึกเพื่อยืนยัน</p>
              </div>
              <button onClick={onClose} className="text-slate-500 hover:text-slate-800 cursor-pointer" type="button" aria-label="ปิดหน้าต่างแก้ไขโครงการ">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 min-h-0 overflow-y-auto px-5 pt-4 pb-3">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-3 items-stretch">
                  {/* Left column — what the project is */}
                  <div className="flex flex-col gap-3 min-w-0">
                    <div>
                      <label className="block text-[#272220] font-bold text-[11px] mb-1">
                        ชื่อโครงการ <span className="text-[#FF6537]">*</span>
                      </label>
                      <input
                        type="text"
                        autoFocus
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        onBlur={() => {
                          const unique = getUniqueTitle(title, otherTitles);
                          if (unique && unique !== title.trim()) {
                            setTitle(unique);
                            setRenameNotice(`ชื่อนี้ถูกใช้แล้ว เปลี่ยนเป็น "${unique}" ให้อัตโนมัติ`);
                            setTimeout(() => setRenameNotice(''), 4000);
                          }
                        }}
                        className={inputClass}
                      />
                      {renameNotice && (
                        <p className="text-xs font-semibold text-[#FF6537] mt-1.5">ℹ️ {renameNotice}</p>
                      )}
                    </div>

                    {/* Grows to soak up whatever height the taller right column adds, so the two
                        columns end on the same line instead of leaving a gap under this one. */}
                    <div className="flex flex-col flex-1">
                      <label className="block text-[#272220] font-bold text-[11px] mb-1">รายละเอียด</label>
                      <textarea
                        rows={3}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className={`${inputClass} flex-1 min-h-20 resize-none`}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[#272220] font-bold text-[11px] mb-1">ประเภทโครงการ</label>
                        <Dropdown<string>
                          value={type ?? ''}
                          onChange={(v) => setType(v || null)}
                          options={[
                            { value: '', label: 'ไม่ระบุ' },
                            ...PROJECT_TYPE_OPTIONS.map((t) => ({ value: t as string, label: `${PROJECT_TYPE_META[t].label} (${t})` })),
                            ...customTypes.map((t) => ({ value: t.id, label: `${t.label} (${t.id})` })),
                          ]}
                        />
                      </div>
                      <div>
                        <label className="block text-[#272220] font-bold text-[11px] mb-1">ตัวย่อประเภทโครงการ</label>
                        <input
                          type="text"
                          readOnly
                          tabIndex={-1}
                          value={type ?? ''}
                          placeholder="เลือกประเภทก่อน"
                          className="w-full p-2.5 text-sm border border-[#E5E5E5] rounded-lg bg-slate-50 text-[#6F6F6F] placeholder:text-[#767676] cursor-default focus:outline-none"
                        />
                      </div>
                    </div>

                    {isSubProject && (
                      <div>
                        <label className="block text-[#272220] font-bold text-[11px] mb-1">
                          โครงการหลัก <span className="text-[#FF6537]">*</span>
                        </label>
                        {topLevelProjects.length === 0 ? (
                          <p className="text-xs text-[#6F6F6F] bg-slate-50 border border-[#E5E5E5] rounded-lg px-3 py-2.5">
                            ยังไม่มีโครงการประเภท "โครงการ (P)" ในระบบให้เลือกเป็นโครงการหลัก
                          </p>
                        ) : (
                          <Dropdown<string>
                            value={parentProjectId ?? ''}
                            onChange={(v) => setParentProjectId(v || null)}
                            placeholder="เลือกโครงการหลัก"
                            options={topLevelProjects.map((p) => ({ value: p.id, label: `${p.title} (${p.code})` }))}
                          />
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="flex items-baseline justify-between mb-1 gap-2">
                          <label className="block text-[#272220] font-bold text-[11px]">ตัวย่อชื่อโครงการ</label>
                        </div>
                        <input
                          type="text"
                          placeholder="เช่น GS"
                          maxLength={10}
                          value={abbreviation}
                          onChange={(e) => setAbbreviation(e.target.value.toUpperCase())}
                          className={inputClass}
                        />
                        <p className="text-[11px] text-[#6F6F6F] mt-1">แก้ไขได้ ไม่เปลี่ยนรหัสโครงการเดิม</p>
                      </div>
                      <div>
                        <label className="block text-[#272220] font-bold text-[11px] mb-1">สถานะ</label>
                        <Dropdown<string>
                          value={status}
                          onChange={setStatus}
                          options={[
                            ...STATUS_OPTIONS.map((s) => ({ value: s, label: STATUS_LABEL[s] })),
                            ...customStatuses.map((s) => ({ value: s.id, label: s.label })),
                          ]}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-baseline justify-between mb-1">
                        <label className="block text-[#272220] font-bold text-[11px]">ระดับความสำคัญ</label>
                        <span className="text-[11px] text-[#6F6F6F]">1 = สำคัญที่สุด, 5 = สำคัญน้อยที่สุด</span>
                      </div>
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
                  </div>

                  {/* Right column — who, how much, when */}
                  <div className="flex flex-col gap-3 min-w-0">
                    <div>
                      <div className="flex items-baseline justify-between mb-1 gap-2">
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
                      {chosenMembers.length > 0 && (
                        <div className="mt-2 space-y-1.5">
                          {chosenMembers.map((emp) => (
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
                                className="flex-1 p-1.5 text-xs border border-[#E5E5E5] rounded-lg placeholder:text-[#767676] focus:outline-none focus:border-[#FF6537]"
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Budget and my own end-date reminder share one row — a separate row for the reminder
                        pushed this column past what fits on a short screen without scrolling. */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[#272220] font-bold text-[11px] mb-1">งบประมาณ (บาท)</label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-[#6F6F6F]">฿</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder="เช่น 500,000"
                            value={formatThousands(budget)}
                            onChange={(e) => setBudget(e.target.value.replace(/[^\d]/g, ''))}
                            className={`${inputClass} pl-6`}
                          />
                        </div>
                      </div>
                      <div className="min-w-0">
                        <label className="block text-[#272220] font-bold text-[11px] mb-1">เตือนฉันก่อนสิ้นสุด</label>
                        <DeadlineReminderField
                          {...savedReminder}
                          limit={reminderLimit(startDate, endDate)}
                          deadlineWord="วันสิ้นสุดโครงการ"
                          note="บันทึกทันที ไม่ต้องรออนุมัติ"
                        />
                      </div>
                    </div>
                    {!(ownerIds.includes(currentUserId) || memberIds.includes(currentUserId)) && (
                      <p className="-mt-1.5 text-[11px] text-amber-700">คุณไม่ได้อยู่ในโครงการนี้ จึงจะไม่ได้รับการเตือนวันสิ้นสุด</p>
                    )}

                    <div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[#272220] font-bold text-[11px] mb-1">วันที่เริ่ม</label>
                          <ThaiDatePicker value={startDate} onChange={setStartDate} />
                        </div>
                        <div>
                          <label className="block text-[#272220] font-bold text-[11px] mb-1">วันที่สิ้นสุด</label>
                          <ThaiDatePicker value={endDate} onChange={setEndDate} min={startDate || undefined} hasError={!dateOrderValid} />
                        </div>
                      </div>
                      {!dateOrderValid && (
                        <p className="text-xs text-red-600 mt-1.5">วันที่สิ้นสุดต้องไม่อยู่ก่อนวันที่เริ่ม</p>
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
                          เหตุผลที่ขอแก้ไข <span className="text-[#FF6537]">*</span>
                        </label>
                        <textarea
                          rows={2}
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          placeholder="โครงการนี้มีผู้รับผิดชอบหลักแล้ว ระบุเหตุผลเพื่อขออนุมัติแก้ไข..."
                          className={inputClass}
                        />
                      </div>
                    )}

                    {formError && (
                      <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{formError}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="shrink-0 px-5 pt-4 pb-5 flex items-center gap-3 border-t border-slate-100">
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
                  disabled={!titleValid || !dateOrderValid || !reasonValid || !parentValid || isSubmitting}
                  className={`flex-1 h-10 flex items-center justify-center gap-1.5 text-white font-bold text-sm rounded-lg transition-colors ${
                    titleValid && dateOrderValid && reasonValid && parentValid && !isSubmitting ? 'bg-[#FF6537] hover:bg-[#e6572c] cursor-pointer' : 'bg-[#F68C6C] cursor-not-allowed'
                  }`}
                >
                  {isSubmitting ? (canEditDirectly ? 'กำลังบันทึก...' : 'กำลังส่งคำขอ...') : canEditDirectly ? 'บันทึกการแก้ไข' : 'ส่งคำขอแก้ไข'}
                  {!isSubmitting && <ArrowRight size={16} />}
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
