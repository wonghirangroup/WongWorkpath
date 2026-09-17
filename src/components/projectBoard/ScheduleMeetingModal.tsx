import { useState, useEffect, useMemo, FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { X, Users2 } from 'lucide-react';
import { Employee, Meeting } from '../../types';
import { ProjectRow } from './types';
import { EmployeeMultiSelect, formatThaiDateShort } from './CreateProjectModal';
import Dropdown from '../Dropdown';
import ThaiDatePicker from '../ThaiDatePicker';
import { useEscapeToClose } from '../../lib/useEscapeToClose';

interface ScheduleMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: ProjectRow[];
  employees: Employee[];
  currentUserId: string;
  onAddMeeting: (meeting: Omit<Meeting, 'id'>) => Promise<void>;
  // Edit mode — mirrors AddTaskModal's own create/edit duality via editingTask. Editing an
  // existing meeting requires a reason (see reasonForChange below), same as cancelling one does;
  // it's not persisted on the meeting row itself (only cancellationReason is), it's just logged
  // via the normal audit trail so there's still a record of why a scheduled meeting changed.
  meetingToEdit?: Meeting | null;
  onUpdateMeeting?: (id: string, updates: Partial<Meeting>, reasonForChange: string) => Promise<void>;
}

// A standalone meeting scheduler for the Calendar page, where there's no project already open to
// borrow context from (unlike AddTaskModal's "การประชุม" tab, always launched from inside a
// specific project). โครงการ here is a real optional picker instead of an implicit prop — picking
// one still clamps the date to that project's own range, same rule AddTaskModal enforces.
export default function ScheduleMeetingModal({ isOpen, onClose, projects, employees, currentUserId, onAddMeeting, meetingToEdit, onUpdateMeeting }: ScheduleMeetingModalProps) {
  const isEditMode = Boolean(meetingToEdit);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState('');
  const [meetingDate, setMeetingDate] = useState('');
  const [meetingStartTime, setMeetingStartTime] = useState('');
  const [meetingEndTime, setMeetingEndTime] = useState('');
  const [attendeeIds, setAttendeeIds] = useState<string[]>([]);
  const [location, setLocation] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  const [reasonForChange, setReasonForChange] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    if (meetingToEdit) {
      setTitle(meetingToEdit.title);
      setDescription(meetingToEdit.description ?? '');
      setProjectId(meetingToEdit.projectId ?? '');
      setMeetingDate(meetingToEdit.date);
      setMeetingStartTime(meetingToEdit.startTime);
      setMeetingEndTime(meetingToEdit.endTime ?? '');
      setAttendeeIds(meetingToEdit.attendeeIds);
      setLocation(meetingToEdit.location ?? '');
      setMeetingLink(meetingToEdit.meetingLink ?? '');
    } else {
      setTitle('');
      setDescription('');
      setProjectId('');
      setMeetingDate('');
      setMeetingStartTime('');
      setMeetingEndTime('');
      setAttendeeIds([]);
      setLocation('');
      setMeetingLink('');
    }
    setReasonForChange('');
    setFormError('');
  }, [isOpen, meetingToEdit]);

  const selectedProject = useMemo(() => projects.find((p) => p.id === projectId), [projects, projectId]);
  const projectStartDate = selectedProject?.startDateISO ?? null;
  const projectEndDate = selectedProject?.endDateISO ?? null;

  // Restricts the attendee picker to people already on the picked project (its owners + members)
  // instead of every employee in the company — left unrestricted while no project is picked
  // ("ไม่ผูกกับโครงการ") or when that project has no owners/members set yet, same "unowned = open"
  // convention used elsewhere.
  const projectMemberIdSet = useMemo(
    () => new Set([...(selectedProject?.ownerEmployeeIds ?? []), ...(selectedProject?.memberEmployeeIds ?? [])]),
    [selectedProject]
  );
  const selectableEmployees = projectMemberIdSet.size === 0
    ? employees
    : employees.filter((e) => projectMemberIdSet.has(e.id) || attendeeIds.includes(e.id));

  const titleValid = title.trim() !== '';
  const meetingTimeOrderValid = !(meetingStartTime && meetingEndTime && meetingEndTime < meetingStartTime);
  const isWithinProjectRange = (dateStr: string) => {
    if (!dateStr) return true;
    if (projectStartDate && dateStr < projectStartDate) return false;
    if (projectEndDate && dateStr > projectEndDate) return false;
    return true;
  };
  const meetingDateInRange = isWithinProjectRange(meetingDate);
  const projectRangeLabel = projectStartDate && projectEndDate
    ? `ต้องอยู่ระหว่าง ${formatThaiDateShort(projectStartDate)} ถึง ${formatThaiDateShort(projectEndDate)} (ช่วงเวลาของโครงการ)`
    : projectStartDate
    ? `ต้องไม่ก่อน ${formatThaiDateShort(projectStartDate)} (วันที่เริ่มโครงการ)`
    : projectEndDate
    ? `ต้องไม่หลัง ${formatThaiDateShort(projectEndDate)} (วันที่สิ้นสุดโครงการ)`
    : '';

  const isFormValid = titleValid && meetingDate.trim() !== '' && meetingStartTime.trim() !== '' && meetingTimeOrderValid && meetingDateInRange
    && (!isEditMode || reasonForChange.trim() !== '');

  const resetAndClose = () => {
    setFormError('');
    onClose();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isFormValid || isSubmitting) return;
    setFormError('');
    setIsSubmitting(true);
    try {
      const payload = {
        projectId: projectId || undefined,
        title: title.trim(),
        description: description.trim() || undefined,
        date: meetingDate,
        startTime: meetingStartTime,
        endTime: meetingEndTime || undefined,
        attendeeIds,
        location: location.trim() || undefined,
        meetingLink: meetingLink.trim() || undefined,
      };
      if (isEditMode && meetingToEdit && onUpdateMeeting) {
        await onUpdateMeeting(meetingToEdit.id, payload, reasonForChange.trim());
      } else {
        await onAddMeeting({ ...payload, createdBy: currentUserId, status: 'scheduled' });
      }
      resetAndClose();
    } catch {
      setFormError(isEditMode ? 'บันทึกการแก้ไขไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' : 'นัดประชุมไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div key="schedule-meeting-modal" className="fixed inset-0 z-50 flex items-center justify-center">
          <motion.div
            className="absolute inset-0 bg-black/15 backdrop-blur-sm"
            onClick={resetAndClose}
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
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <Users2 size={15} className="text-[#FF6537]" /> {isEditMode ? 'แก้ไขการประชุม' : 'นัดประชุมใหม่'}
                </h3>
                <p className="text-[11px] text-[#6F6F6F] mt-0.5">{isEditMode ? 'ปรับข้อมูลการประชุมแล้วระบุเหตุผลที่แก้ไข' : 'กรอกรายละเอียดการประชุม'}</p>
              </div>
              <button onClick={resetAndClose} className="text-slate-400 hover:text-slate-600 cursor-pointer" type="button">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 min-h-0 overflow-y-auto px-5 pt-4 pb-1 space-y-3">
                <div>
                  <label className="block text-[#272220] font-bold text-[11px] mb-1">
                    ชื่อการประชุม <span className="text-[#FF6537]">*</span>
                  </label>
                  <input
                    type="text"
                    autoFocus
                    placeholder="เช่น ประชุมทบทวนความคืบหน้าโครงการ"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full p-2.5 text-sm border border-[#E5E5E5] rounded-lg placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#FF6537]"
                  />
                </div>

                <div>
                  <label className="block text-[#272220] font-bold text-[11px] mb-1">โครงการ (ไม่บังคับ)</label>
                  <Dropdown
                    value={projectId}
                    onChange={(value) => { setProjectId(value); setMeetingDate(''); }}
                    placeholder="ไม่ผูกกับโครงการ"
                    options={[{ value: '', label: 'ไม่ผูกกับโครงการ' }, ...projects.map((p) => ({ value: p.id, label: p.title }))]}
                  />
                </div>

                <div>
                  <label className="block text-[#272220] font-bold text-[11px] mb-1">รายละเอียด (ไม่บังคับ)</label>
                  <textarea
                    rows={2}
                    placeholder="อธิบายรายละเอียดของการประชุมนี้..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full p-2.5 text-sm border border-[#E5E5E5] rounded-lg placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#FF6537]"
                  />
                </div>

                <div>
                  <label className="block text-[#272220] font-bold text-[11px] mb-1">
                    วัน-เวลานัดประชุม <span className="text-[#FF6537]">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-1">
                      <label className="block text-[#A0A0A0] text-[10px] mb-1">วันที่</label>
                      <ThaiDatePicker
                        value={meetingDate}
                        onChange={setMeetingDate}
                        min={projectStartDate || undefined}
                        max={projectEndDate || undefined}
                        hasError={!meetingDateInRange}
                      />
                    </div>
                    <div>
                      <label className="block text-[#A0A0A0] text-[10px] mb-1">เวลาเริ่ม</label>
                      <input
                        type="time"
                        value={meetingStartTime}
                        onChange={(e) => setMeetingStartTime(e.target.value)}
                        className="w-full p-2.5 text-sm border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#FF6537]"
                      />
                    </div>
                    <div>
                      <label className="block text-[#A0A0A0] text-[10px] mb-1">เวลาสิ้นสุด</label>
                      <input
                        type="time"
                        value={meetingEndTime}
                        onChange={(e) => setMeetingEndTime(e.target.value)}
                        className={`w-full p-2.5 text-sm border rounded-lg focus:outline-none focus:border-[#FF6537] ${
                          meetingTimeOrderValid ? 'border-[#E5E5E5]' : 'border-red-400'
                        }`}
                      />
                    </div>
                  </div>
                  {!meetingTimeOrderValid && (
                    <p className="text-xs text-red-600 mt-1.5">เวลาสิ้นสุดต้องไม่อยู่ก่อนเวลาเริ่ม</p>
                  )}
                  {meetingTimeOrderValid && !meetingDateInRange && projectRangeLabel && (
                    <p className="text-xs text-red-600 mt-1.5">วันที่ประชุม{projectRangeLabel}</p>
                  )}
                </div>

                <div>
                  <label className="block text-[#272220] font-bold text-[11px] mb-1">ผู้เข้าร่วมประชุม (ไม่บังคับ)</label>
                  <EmployeeMultiSelect
                    employees={selectableEmployees}
                    valueIds={attendeeIds}
                    onChange={setAttendeeIds}
                    placeholder="ค้นหาหรือเลือกพนักงาน..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[#272220] font-bold text-[11px] mb-1">สถานที่ (ไม่บังคับ)</label>
                    <input
                      type="text"
                      placeholder="เช่น ห้องประชุมชั้น 3"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="w-full p-2.5 text-sm border border-[#E5E5E5] rounded-lg placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#FF6537]"
                    />
                  </div>
                  <div>
                    <label className="block text-[#272220] font-bold text-[11px] mb-1">ลิงก์ประชุมออนไลน์ (ไม่บังคับ)</label>
                    <input
                      type="text"
                      placeholder="เช่น https://meet.google.com/..."
                      value={meetingLink}
                      onChange={(e) => setMeetingLink(e.target.value)}
                      className="w-full p-2.5 text-sm border border-[#E5E5E5] rounded-lg placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#FF6537]"
                    />
                  </div>
                </div>

                {isEditMode && (
                  <div>
                    <label className="block text-[#272220] font-bold text-[11px] mb-1">
                      เหตุผลที่แก้ไข <span className="text-[#FF6537]">*</span>
                    </label>
                    <textarea
                      rows={2}
                      placeholder="เช่น เปลี่ยนสถานที่ประชุมตามคำขอของทีม..."
                      value={reasonForChange}
                      onChange={(e) => setReasonForChange(e.target.value)}
                      className="w-full p-2.5 text-sm border border-[#E5E5E5] rounded-lg placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#FF6537]"
                    />
                  </div>
                )}

                {formError && (
                  <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{formError}</p>
                )}
              </div>

              <div className="shrink-0 px-5 pt-4 pb-5 flex items-center gap-3">
                <button
                  type="button"
                  onClick={resetAndClose}
                  className="px-4 h-10 text-sm font-semibold text-[#6F6F6F] hover:bg-slate-50 rounded-lg border border-[#E5E5E5] cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={!isFormValid || isSubmitting}
                  className={`flex-1 h-10 text-white font-bold text-sm rounded-lg transition-colors ${
                    isFormValid && !isSubmitting ? 'bg-[#FF6537] hover:bg-[#e6572c] cursor-pointer' : 'bg-[#F68C6C] cursor-not-allowed'
                  }`}
                >
                  {isSubmitting ? 'กำลังบันทึก...' : isEditMode ? 'บันทึกการแก้ไข' : 'นัดประชุม'}
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
