import { useState, useEffect, useMemo, FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { X, Folder, ListChecks, Users2 } from 'lucide-react';
import { Employee, Meeting } from '../../types';
import { ProjectRow, ProjectTaskItem, ProjectTaskStatus } from './types';
import { EmployeeMultiSelect, displayName, formatThaiDateShort, PRIORITY_OPTIONS, Priority } from './CreateProjectModal';
import { TASK_STATUS_LABEL } from './statusMeta';
import { getAvatarColor } from '../../lib/avatarColor';
import Dropdown from '../Dropdown';

type ModalMode = 'task' | 'meeting';

const TASK_STATUS_OPTIONS: { value: ProjectTaskStatus; label: string }[] = [
  { value: 'todo', label: TASK_STATUS_LABEL.todo },
  { value: 'in_progress', label: TASK_STATUS_LABEL.in_progress },
  { value: 'review', label: TASK_STATUS_LABEL.review },
  { value: 'blocked', label: TASK_STATUS_LABEL.blocked },
  { value: 'done', label: TASK_STATUS_LABEL.done },
];

interface AddTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Omit<ProjectTaskItem, 'id'>) => Promise<ProjectTaskItem>;
  onAddMeeting: (meeting: Omit<Meeting, 'id'>) => Promise<void>;
  onUpdateTask?: (id: string, updates: Partial<ProjectTaskItem>) => Promise<void>;
  onCreateFolder: (name: string, parentId?: string | null, taskId?: string) => string;
  // '' means there's no fixed project context (e.g. opened from the Dashboard's quick-add, not
  // from inside a project) — the modal then shows its own required project picker and resolves
  // projectDocFolderId/projectStartDate/projectEndDate from whichever project gets picked, using
  // `projects` below, instead of trusting the fixed props (which are meaningless without a project).
  projectId: string;
  projectDocFolderId?: string | null;
  // A task's dates and a meeting's date must fall within the project's own timeframe, when the
  // project has one set — null/undefined on either end means that side is open-ended.
  projectStartDate?: string | null;
  projectEndDate?: string | null;
  // Only needed when projectId === '' — powers the project picker.
  projects?: ProjectRow[];
  employees: Employee[];
  currentUserId: string;
  // When set, the modal opens straight into "แก้ไขงาน" for this task instead of a blank "เพิ่มงาน
  // ใหม่" form — locked to task mode (editing an existing task into a meeting doesn't make sense).
  editingTask?: ProjectTaskItem | null;
}

// Both tasks and meetings are real, network-persisted data now (see AppDataContext's
// handleAddProjectTask/handleAddMeeting) — creating or editing either can genuinely fail, so both
// branches of handleSubmit await the call and show an inline error instead of closing blind. The
// "create a folder" option also writes to the shared document store via onCreateFolder, same as
// CreateProjectModal's own folder step.
export default function AddTaskModal({ isOpen, onClose, onSave, onAddMeeting, onUpdateTask, onCreateFolder, projectId, projectDocFolderId, projectStartDate, projectEndDate, projects, employees, currentUserId, editingTask }: AddTaskModalProps) {
  const needsProjectPicker = !projectId;
  const [mode, setMode] = useState<ModalMode>('task');
  const [pickedProjectId, setPickedProjectId] = useState('');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority | null>(null);
  const [status, setStatus] = useState<ProjectTaskStatus>('todo');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [reviewerIds, setReviewerIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [createFolder, setCreateFolder] = useState(false);
  const [folderName, setFolderName] = useState('');

  const [meetingDate, setMeetingDate] = useState('');
  const [meetingStartTime, setMeetingStartTime] = useState('');
  const [meetingEndTime, setMeetingEndTime] = useState('');
  const [attendeeIds, setAttendeeIds] = useState<string[]>([]);
  const [location, setLocation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const isEditing = Boolean(editingTask);

  // The component instance stays mounted between opens, so without this a second "แก้ไข" click on
  // a different task would still show whatever the previous open left behind.
  useEffect(() => {
    if (!isOpen) return;
    setMode('task');
    setPickedProjectId('');
    if (editingTask) {
      setTitle(editingTask.title);
      setDescription(editingTask.description ?? '');
      setPriority(editingTask.priority ?? null);
      setStatus(editingTask.status);
      setAssigneeIds(editingTask.assigneeEmployeeIds);
      setReviewerIds(editingTask.reviewerEmployeeIds ?? []);
      setStartDate(editingTask.startDateISO ?? '');
      setDueDate(editingTask.dueDateISO ?? '');
    } else {
      setTitle('');
      setDescription('');
      setPriority(null);
      setStatus('todo');
      setAssigneeIds([]);
      setReviewerIds([]);
      setStartDate('');
      setDueDate('');
    }
    setCreateFolder(true);
    setFolderName('');
    setMeetingDate('');
    setMeetingStartTime('');
    setMeetingEndTime('');
    setAttendeeIds([]);
    setLocation('');
    setFormError('');
  }, [isOpen, editingTask]);

  // "สร้างโฟลเดอร์เอกสาร" defaults to checked (see the reset effect above) — this keeps the folder
  // name synced to the task title as it's typed, the same "only if not already set" rule the
  // checkbox's own onChange used before it defaulted to checked at all.
  useEffect(() => {
    if (!isEditing && createFolder && !folderName.trim()) setFolderName(title.trim());
  }, [title]);

  const creator = employees.find((e) => e.id === currentUserId);
  const titleValid = title.trim() !== '';
  const taskDateOrderValid = !(startDate && dueDate && dueDate < startDate);
  const meetingTimeOrderValid = !(meetingStartTime && meetingEndTime && meetingEndTime < meetingStartTime);

  // When there's no fixed project (opened from the Dashboard's quick-add), everything that would
  // normally come from a fixed prop instead comes from whichever project gets picked below.
  const pickedProject = useMemo(() => projects?.find((p) => p.id === pickedProjectId), [projects, pickedProjectId]);
  const effectiveProjectId = projectId || pickedProjectId;
  const effectiveProjectDocFolderId = needsProjectPicker ? pickedProject?.docFolderId : projectDocFolderId;
  const effectiveProjectStartDate = needsProjectPicker ? pickedProject?.startDateISO : projectStartDate;
  const effectiveProjectEndDate = needsProjectPicker ? pickedProject?.endDateISO : projectEndDate;

  // A task's dates / a meeting's date must fall inside the project's own timeframe, when the
  // project has one set at all — an open-ended project (no start/end) imposes no constraint.
  const isWithinProjectRange = (dateStr: string) => {
    if (!dateStr) return true;
    if (effectiveProjectStartDate && dateStr < effectiveProjectStartDate) return false;
    if (effectiveProjectEndDate && dateStr > effectiveProjectEndDate) return false;
    return true;
  };
  const taskStartInRange = isWithinProjectRange(startDate);
  const taskDueInRange = isWithinProjectRange(dueDate);
  const meetingDateInRange = isWithinProjectRange(meetingDate);
  const projectRangeLabel = effectiveProjectStartDate && effectiveProjectEndDate
    ? `ต้องอยู่ระหว่าง ${formatThaiDateShort(effectiveProjectStartDate)} ถึง ${formatThaiDateShort(effectiveProjectEndDate)} (ช่วงเวลาของโครงการ)`
    : effectiveProjectStartDate
    ? `ต้องไม่ก่อน ${formatThaiDateShort(effectiveProjectStartDate)} (วันที่เริ่มโครงการ)`
    : effectiveProjectEndDate
    ? `ต้องไม่หลัง ${formatThaiDateShort(effectiveProjectEndDate)} (วันที่สิ้นสุดโครงการ)`
    : '';

  const isFormValid = effectiveProjectId !== '' && (mode === 'task'
    ? titleValid && taskDateOrderValid && taskStartInRange && taskDueInRange
    : titleValid && meetingDate.trim() !== '' && meetingStartTime.trim() !== '' && meetingTimeOrderValid && meetingDateInRange);

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
      if (mode === 'meeting') {
        await onAddMeeting({
          projectId: effectiveProjectId,
          title: title.trim(),
          description: description.trim() || undefined,
          date: meetingDate,
          startTime: meetingStartTime,
          endTime: meetingEndTime || undefined,
          attendeeIds,
          location: location.trim() || undefined,
          createdBy: currentUserId,
        });
      } else {
        // Raw ISO dates, not Thai-formatted text — the server owns formatting (and daysUntilDue)
        // now, same as CreateProjectModal already sends raw dates for projects. Sending
        // Thai-formatted text into a DATE column previously caused a 500 on every task save.
        const taskFields = {
          title: title.trim(),
          description: description.trim() || undefined,
          priority: priority ?? undefined,
          assigneeEmployeeIds: assigneeIds,
          reviewerEmployeeIds: reviewerIds,
          startDate: startDate || null,
          dueDate: dueDate || null,
          // Status is only ever editable from the edit form (see the "สถานะงาน" dropdown below,
          // rendered only when isEditing) — creation always starts a task at 'todo' via the
          // separate onSave call further down, untouched by this field.
          ...(isEditing ? { status } : {}),
        };

        if (editingTask && onUpdateTask) {
          await onUpdateTask(editingTask.id, taskFields);
        } else {
          // Created first (not the folder) so the real new task id exists to tag the folder with —
          // DocVault uses that tag to show "this belongs to task X" (see LinkedDoc.taskId).
          const createdTask = await onSave({
            projectId: effectiveProjectId,
            status: 'todo',
            creatorEmployeeId: currentUserId,
            progress: 0,
            checklist: [],
            ...taskFields,
          });
          // Folder creation is create-only — re-offering it on every edit-save would spawn a fresh
          // duplicate folder each time, since there's no "already created" flag to check against.
          if (createFolder && folderName.trim()) onCreateFolder(folderName.trim(), effectiveProjectDocFolderId ?? null, createdTask.id);
        }
      }
      resetAndClose();
    } catch {
      setFormError(
        mode === 'meeting' ? 'นัดประชุมไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' : isEditing ? 'บันทึกการแก้ไขไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' : 'เพิ่มงานไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div key="add-task-modal" className="fixed inset-0 z-50 flex items-center justify-center">
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
                <h3 className="text-sm font-bold text-slate-800">
                  {isEditing ? 'แก้ไขงาน' : mode === 'task' ? 'เพิ่มงานใหม่' : 'นัดประชุมใหม่'}
                </h3>
                <p className="text-[11px] text-[#6F6F6F] mt-0.5">
                  {isEditing
                    ? 'ปรับรายละเอียดงานแล้วกดบันทึกเพื่อยืนยัน'
                    : needsProjectPicker
                    ? 'เลือกโครงการแล้วกรอกรายละเอียดงาน'
                    : mode === 'task' ? 'กรอกรายละเอียดงานสำหรับโครงการนี้' : 'กรอกรายละเอียดการประชุมสำหรับโครงการนี้'}
                </p>
              </div>
              <button onClick={resetAndClose} className="text-slate-400 hover:text-slate-600 cursor-pointer" type="button">
                <X size={18} />
              </button>
            </div>

            {!isEditing && !needsProjectPicker && (
            <div className="flex items-center gap-1 px-5 pb-3 shrink-0">
              <button
                type="button"
                onClick={() => setMode('task')}
                className={`flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                  mode === 'task' ? 'bg-[#FFF1EC] text-[#FF6537]' : 'text-[#6F6F6F] hover:bg-slate-50'
                }`}
              >
                <ListChecks size={13} /> งาน
              </button>
              <button
                type="button"
                onClick={() => setMode('meeting')}
                className={`flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                  mode === 'meeting' ? 'bg-[#FFF1EC] text-[#FF6537]' : 'text-[#6F6F6F] hover:bg-slate-50'
                }`}
              >
                <Users2 size={13} /> การประชุม
              </button>
            </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 min-h-0 overflow-y-auto px-5 pt-4 pb-1 space-y-3">
                <div>
                  <label className="block text-[#272220] font-bold text-[11px] mb-1">
                    {mode === 'task' ? 'ชื่องาน' : 'ชื่อการประชุม'} <span className="text-[#FF6537]">*</span>
                  </label>
                  <input
                    type="text"
                    autoFocus
                    placeholder={mode === 'task' ? 'เช่น ออกแบบหน้าร้านใหม่' : 'เช่น ประชุมทบทวนความคืบหน้าโครงการ'}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full p-2.5 text-sm border border-[#E5E5E5] rounded-lg placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#FF6537]"
                  />
                </div>

                {needsProjectPicker && (
                  <div>
                    <label className="block text-[#272220] font-bold text-[11px] mb-1">
                      โครงการ <span className="text-[#FF6537]">*</span>
                    </label>
                    <Dropdown
                      value={pickedProjectId}
                      onChange={(value) => { setPickedProjectId(value); setStartDate(''); setDueDate(''); }}
                      placeholder="เลือกโครงการ..."
                      options={(projects ?? []).map((p) => ({ value: p.id, label: p.title }))}
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[#272220] font-bold text-[11px] mb-1">รายละเอียด (ไม่บังคับ)</label>
                  <textarea
                    rows={3}
                    placeholder="อธิบายรายละเอียดของงานนี้..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full p-2.5 text-sm border border-[#E5E5E5] rounded-lg placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#FF6537]"
                  />
                </div>

                <div>
                  <label className="block text-[#272220] font-bold text-[11px] mb-1">ใครเป็นคนสร้าง</label>
                  <div className="flex items-center gap-2.5 p-2 text-sm border border-[#E5E5E5] rounded-lg bg-slate-50">
                    {creator?.avatar ? (
                      <img src={creator.avatar} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                    ) : (
                      <span
                        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{ backgroundColor: getAvatarColor(creator ? displayName(creator) : '?') }}
                      >
                        {creator ? displayName(creator).trim().charAt(0).toUpperCase() : '?'}
                      </span>
                    )}
                    <span className="text-slate-700">{creator ? displayName(creator) : 'ไม่ทราบผู้ใช้งาน'}</span>
                  </div>
                </div>

                {mode === 'task' ? (
                  <>
                    <div>
                      <label className="block text-[#272220] font-bold text-[11px] mb-1">ใครรับผิดชอบ (เลือกได้มากกว่า 1)</label>
                      <EmployeeMultiSelect
                        employees={employees}
                        valueIds={assigneeIds}
                        onChange={setAssigneeIds}
                        placeholder="ค้นหาหรือเลือกพนักงาน..."
                      />
                    </div>

                    <div>
                      <label className="block text-[#272220] font-bold text-[11px] mb-1">ผู้ตรวจงาน (ไม่บังคับ, เลือกได้มากกว่า 1)</label>
                      <EmployeeMultiSelect
                        employees={employees}
                        valueIds={reviewerIds}
                        onChange={setReviewerIds}
                        placeholder="ค้นหาหรือเลือกพนักงาน..."
                      />
                      <p className="text-[10px] text-[#A0A0A0] mt-1">ผู้ตรวจคนใดคนหนึ่งกดผ่าน/ตีกลับก็มีผลทันที ถ้ายังไม่เลือกตอนนี้ เลือกได้อีกครั้งตอนกด "ส่งงาน"</p>
                    </div>

                    <div>
                      <label className="block text-[#272220] font-bold text-[11px] mb-1">ระดับความสำคัญ (ไม่บังคับ)</label>
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

                    {isEditing && (
                      <div>
                        <label className="block text-[#272220] font-bold text-[11px] mb-1">สถานะงาน</label>
                        <Dropdown<ProjectTaskStatus> value={status} onChange={setStatus} options={TASK_STATUS_OPTIONS} />
                      </div>
                    )}

                    <div>
                      <label className="block text-[#272220] font-bold text-[11px] mb-1">ระยะเวลา</label>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[#A0A0A0] text-[10px] mb-1">วันที่เริ่ม</label>
                          <input
                            type="date"
                            value={startDate}
                            min={effectiveProjectStartDate || undefined}
                            max={effectiveProjectEndDate || undefined}
                            onChange={(e) => setStartDate(e.target.value)}
                            className={`w-full p-2.5 text-sm border rounded-lg focus:outline-none focus:border-[#FF6537] ${
                              taskStartInRange ? 'border-[#E5E5E5]' : 'border-red-400'
                            }`}
                          />
                        </div>
                        <div>
                          <label className="block text-[#A0A0A0] text-[10px] mb-1">กำหนดส่ง</label>
                          <input
                            type="date"
                            value={dueDate}
                            min={startDate || effectiveProjectStartDate || undefined}
                            max={effectiveProjectEndDate || undefined}
                            onChange={(e) => setDueDate(e.target.value)}
                            className={`w-full p-2.5 text-sm border rounded-lg focus:outline-none focus:border-[#FF6537] ${
                              taskDateOrderValid && taskDueInRange ? 'border-[#E5E5E5]' : 'border-red-400'
                            }`}
                          />
                        </div>
                      </div>
                      {!taskDateOrderValid && (
                        <p className="text-xs text-red-600 mt-1.5">กำหนดส่งต้องไม่อยู่ก่อนวันที่เริ่ม</p>
                      )}
                      {taskDateOrderValid && (!taskStartInRange || !taskDueInRange) && projectRangeLabel && (
                        <p className="text-xs text-red-600 mt-1.5">วันที่ของงาน{projectRangeLabel}</p>
                      )}
                    </div>

                    {!isEditing && (
                    <div className="border-t border-slate-100 pt-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={createFolder}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setCreateFolder(checked);
                            if (checked && !folderName.trim()) setFolderName(title.trim());
                          }}
                          className="rounded border-[#E5E5E5] text-[#FF6537] focus:ring-[#FF6537] cursor-pointer"
                        />
                        <Folder size={14} className="text-[#6F6F6F]" />
                        <span className="text-[#272220] font-bold text-[11px]">
                          {effectiveProjectDocFolderId ? 'สร้างโฟลเดอร์เอกสารในโครงการนี้ (ไม่บังคับ)' : 'สร้างโฟลเดอร์เอกสารใน "เอกสาร Drive" (ไม่บังคับ)'}
                        </span>
                      </label>
                      {createFolder && (
                        <input
                          type="text"
                          placeholder="ชื่อโฟลเดอร์"
                          value={folderName}
                          onChange={(e) => setFolderName(e.target.value)}
                          className="w-full mt-2 p-2.5 text-sm border border-[#E5E5E5] rounded-lg placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#FF6537]"
                        />
                      )}
                    </div>
                    )}
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-[#272220] font-bold text-[11px] mb-1">
                        วัน-เวลานัดประชุม <span className="text-[#FF6537]">*</span>
                      </label>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-1">
                          <label className="block text-[#A0A0A0] text-[10px] mb-1">วันที่</label>
                          <input
                            type="date"
                            value={meetingDate}
                            min={effectiveProjectStartDate || undefined}
                            max={effectiveProjectEndDate || undefined}
                            onChange={(e) => setMeetingDate(e.target.value)}
                            className={`w-full p-2.5 text-sm border rounded-lg focus:outline-none focus:border-[#FF6537] ${
                              meetingDateInRange ? 'border-[#E5E5E5]' : 'border-red-400'
                            }`}
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
                        employees={employees}
                        valueIds={attendeeIds}
                        onChange={setAttendeeIds}
                        placeholder="ค้นหาหรือเลือกพนักงาน..."
                      />
                    </div>

                    <div>
                      <label className="block text-[#272220] font-bold text-[11px] mb-1">สถานที่ / ลิงก์ประชุมออนไลน์ (ไม่บังคับ)</label>
                      <input
                        type="text"
                        placeholder="เช่น ห้องประชุมชั้น 3 หรือ https://meet.google.com/..."
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        className="w-full p-2.5 text-sm border border-[#E5E5E5] rounded-lg placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#FF6537]"
                      />
                    </div>
                  </>
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
                  {isSubmitting ? 'กำลังบันทึก...' : isEditing ? 'บันทึกการแก้ไข' : mode === 'task' ? 'เพิ่มงาน' : 'นัดประชุม'}
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
