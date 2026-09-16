import { useState, FormEvent, KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { X, ArrowRight } from 'lucide-react';
import { useEscapeToClose } from '../../lib/useEscapeToClose';
import ThaiDatePicker from '../ThaiDatePicker';
import { Employee } from '../../types';
import { ProjectRow, ProjectType, CustomProjectStatus } from './types';
import { STATUS_LABEL, PROJECT_TYPE_META, PROJECT_TYPE_OPTIONS } from './statusMeta';
import {
  EmployeeSearchSelect,
  EmployeeMultiSelect,
  PRIORITY_OPTIONS,
  Priority,
  STATUS_OPTIONS,
  getUniqueTitle,
  displayName,
} from './CreateProjectModal';
import { ApiError } from '../../lib/api';
import { formatThousands } from '../../lib/numberFormat';
import Dropdown from '../Dropdown';
import Tooltip from '../Tooltip';

interface EditProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  row: ProjectRow;
  employees: Employee[];
  onSave: (updates: Partial<ProjectRow>) => Promise<void>;
  existingTitles: string[];
  customStatuses: CustomProjectStatus[];
}

// Single-screen edit form (not the create wizard's 3 steps) — editing an existing project should
// show every field at once rather than re-running a step-by-step flow each time. Only fields the
// create wizard itself collects are editable here (see CreateProjectModal's own note on why
// "department" has no field yet) — this stays a straight edit of what's already there.
export default function EditProjectModal({ isOpen, onClose, row, employees, onSave, existingTitles, customStatuses }: EditProjectModalProps) {
  useEscapeToClose(isOpen, onClose);
  const [title, setTitle] = useState(row.title);
  const [renameNotice, setRenameNotice] = useState('');
  // Renaming to the project's own current title is never a "collision" with itself.
  const otherTitles = existingTitles.filter((t) => t.trim().toLowerCase() !== row.title.trim().toLowerCase());
  const [description, setDescription] = useState(row.description ?? '');
  const [type, setType] = useState<ProjectType | null>(row.type ?? null);
  const [abbreviation, setAbbreviation] = useState(row.abbreviation ?? '');
  const [ownerId, setOwnerId] = useState(row.ownerEmployeeId ?? '');
  const [memberIds, setMemberIds] = useState<string[]>(row.memberEmployeeIds ?? []);
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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!titleValid || !dateOrderValid || isSubmitting) return;
    setFormError('');
    setIsSubmitting(true);
    // Safety net alongside the title field's own onBlur (see CreateProjectModal's identical note).
    const finalTitle = getUniqueTitle(title, otherTitles);
    try {
      await onSave({
        title: finalTitle,
        description: description.trim() || undefined,
        type: type ?? undefined,
        abbreviation: abbreviation.trim() || undefined,
        priority: priority ?? undefined,
        ownerEmployeeId: ownerId || null,
        memberEmployeeIds: memberIds,
        memberDuties: Object.fromEntries(
          Object.entries(memberDuties).filter(([id, duty]) => memberIds.includes(id) && duty.trim() !== '')
        ),
        status,
        budget: budget.trim() !== '' && !isNaN(Number(budget)) ? Number(budget) : null,
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
            className="relative bg-white rounded-2xl shadow-[0px_12px_36px_-8px_rgba(0,0,0,0.12)] w-full max-w-lg mx-4 max-h-[85vh] overflow-hidden flex flex-col"
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
                    onBlur={() => {
                      const unique = getUniqueTitle(title, otherTitles);
                      if (unique && unique !== title.trim()) {
                        setTitle(unique);
                        setRenameNotice(`ชื่อนี้ถูกใช้แล้ว เปลี่ยนเป็น "${unique}" ให้อัตโนมัติ`);
                        setTimeout(() => setRenameNotice(''), 4000);
                      }
                    }}
                    className="w-full p-2.5 text-sm border border-[#E5E5E5] rounded-lg placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#FF6537]"
                  />
                  {renameNotice && (
                    <p className="text-xs font-semibold text-[#FF6537] mt-1.5">ℹ️ {renameNotice}</p>
                  )}
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

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[#272220] font-bold text-[11px] mb-1">ประเภทโครงการ</label>
                    <Dropdown<ProjectType | ''>
                      value={type ?? ''}
                      onChange={(v) => setType((v || null) as ProjectType | null)}
                      options={[
                        { value: '', label: 'ไม่ระบุ' },
                        ...PROJECT_TYPE_OPTIONS.map((t) => ({ value: t, label: `${PROJECT_TYPE_META[t].label} (${t})` })),
                      ]}
                    />
                  </div>
                  <div>
                    <label className="block text-[#272220] font-bold text-[11px] mb-1">ตัวย่อโครงการ</label>
                    <input
                      type="text"
                      readOnly
                      tabIndex={-1}
                      value={type ?? ''}
                      placeholder="เลือกประเภทก่อน"
                      className="w-full p-2.5 text-sm border border-[#E5E5E5] rounded-lg bg-slate-50 text-[#6F6F6F] placeholder:text-[#B0B0B0] cursor-default focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-baseline justify-between mb-1">
                    <label className="block text-[#272220] font-bold text-[11px]">ตัวย่อชื่อโครงการ</label>
                    <span className="text-[10px] text-[#6F6F6F]">แก้ไขได้ ไม่เปลี่ยนรหัสโครงการเดิม</span>
                  </div>
                  <input
                    type="text"
                    placeholder="เช่น GS"
                    maxLength={10}
                    value={abbreviation}
                    onChange={(e) => setAbbreviation(e.target.value.toUpperCase())}
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
                  <label className="block text-[#272220] font-bold text-[11px] mb-1">ผู้รับผิดชอบร่วม</label>
                  <EmployeeMultiSelect
                    employees={employees}
                    valueIds={memberIds}
                    onChange={setMemberIds}
                    placeholder="ค้นหาแล้วเลือกเพิ่มได้หลายคน..."
                  />
                  {employees.filter((e) => memberIds.includes(e.id)).length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {employees.filter((e) => memberIds.includes(e.id)).map((emp) => (
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

                <div>
                  <div className="flex items-baseline justify-between mb-1">
                    <label className="block text-[#272220] font-bold text-[11px]">ระดับความสำคัญ</label>
                    <span className="text-[10px] text-[#A0A0A0]">1 = สำคัญที่สุด, 5 = สำคัญน้อยที่สุด</span>
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

                <div className="grid grid-cols-2 gap-3">
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

                  <div>
                    <label className="block text-[#272220] font-bold text-[11px] mb-1">งบประมาณ (บาท)</label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-[#B0B0B0]">฿</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="เช่น 500,000"
                        value={formatThousands(budget)}
                        onChange={(e) => setBudget(e.target.value.replace(/[^\d]/g, ''))}
                        className="w-full p-2.5 pl-6 text-sm border border-[#E5E5E5] rounded-lg placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#FF6537]"
                      />
                    </div>
                  </div>
                </div>

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
                  <p className="text-xs text-red-600 -mt-1.5">วันที่สิ้นสุดต้องไม่อยู่ก่อนวันที่เริ่ม</p>
                )}

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
                  disabled={!titleValid || !dateOrderValid || isSubmitting}
                  className={`flex-1 h-10 flex items-center justify-center gap-1.5 text-white font-bold text-sm rounded-lg transition-colors ${
                    titleValid && dateOrderValid && !isSubmitting ? 'bg-[#FF6537] hover:bg-[#e6572c] cursor-pointer' : 'bg-[#F68C6C] cursor-not-allowed'
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
