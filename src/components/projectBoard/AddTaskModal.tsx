import { useState, useEffect, useMemo, FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { X, Folder, ListChecks, Users2 } from 'lucide-react';
import { Employee, Meeting } from '../../types';
import { ProjectRow, ProjectTaskItem, ProjectTaskStatus } from './types';
import { EmployeeMultiSelect, displayName, formatThaiDateShort, PRIORITY_OPTIONS, Priority } from './CreateProjectModal';
import { TASK_STATUS_LABEL, TASK_STATUS_COLOR } from './statusMeta';
import { ChangeRequest } from '../../lib/api';
import { isOwner } from '../../lib/ownership';
import Dropdown from '../Dropdown';
import EmployeeAvatar from '../EmployeeAvatar';
import ThaiDatePicker from '../ThaiDatePicker';
import { useEscapeToClose } from '../../lib/useEscapeToClose';

type ModalMode = 'task' | 'meeting';

// A task's status now follows the actual work process instead of being freely pickable: no
// assignee yet -> ยังไม่เริ่ม, an assignee set -> กำลังทำ, and รอตรวจ/เสร็จแล้ว only ever happen
// through the real "ส่งงาน"/"ตรวจงาน" flows (SubmitTaskModal/ReviewTaskModal) — editing here never
// regresses either of those back to todo/in_progress. ติดปัญหา is the one manual override left,
// via the checkbox below, and wins over everything else while it's checked.
function computeTaskStatus(currentStatus: ProjectTaskStatus | undefined, assigneeIds: string[], blocked: boolean): ProjectTaskStatus {
  if (blocked) return 'blocked';
  if (currentStatus === 'review' || currentStatus === 'done') return currentStatus;
  return assigneeIds.length > 0 ? 'in_progress' : 'todo';
}

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
  // Restricts the assignee/reviewer/attendee pickers to people already on this project (its
  // owners + members) instead of every employee in the company. Only meaningful when projectId
  // is fixed — when there's no fixed project yet, the equivalent list is derived from whichever
  // project the picker above resolves to instead. An empty list (no owners/members set yet)
  // leaves the picker open to everyone, same "unowned = open" convention used elsewhere.
  projectMemberIds?: string[];
  employees: Employee[];
  currentUserId: string;
  // When set, the modal opens straight into "แก้ไขงาน" for this task instead of a blank "เพิ่มงาน
  // ใหม่" form — locked to task mode (editing an existing task into a meeting doesn't make sense).
  editingTask?: ProjectTaskItem | null;
  // When set (create mode only — editingTask already carries its own parentTaskId), this modal
  // creates a งานย่อย under this task instead of a top-level task: locked to task mode (no
  // "subtask meeting"), and the new row's parentTaskId is set to parentTask.id on save.
  parentTask?: ProjectTaskItem | null;
  // Only meaningful in edit mode — an unowned task (or one the current user is an assignee of)
  // still saves directly; anyone else's edit files a change_request instead. Optional since the
  // create-only instance in AppLayout.tsx (the Dashboard's quick-add) never sets editingTask.
  changeRequests?: ChangeRequest[];
  onRequestChange?: (
    entityType: 'project' | 'project_task',
    entityId: string,
    requestType: 'edit' | 'delete',
    proposedChanges: Record<string, unknown> | undefined,
    reason: string
  ) => Promise<void>;
}

// Both tasks and meetings are real, network-persisted data now (see AppDataContext's
// handleAddProjectTask/handleAddMeeting) — creating or editing either can genuinely fail, so both
// branches of handleSubmit await the call and show an inline error instead of closing blind. The
// "create a folder" option also writes to the shared document store via onCreateFolder, same as
// CreateProjectModal's own folder step.
export default function AddTaskModal({ isOpen, onClose, onSave, onAddMeeting, onUpdateTask, onCreateFolder, projectId, projectDocFolderId, projectStartDate, projectEndDate, projects, projectMemberIds, employees, currentUserId, editingTask, parentTask, changeRequests, onRequestChange }: AddTaskModalProps) {
  const needsProjectPicker = !projectId;
  const [mode, setMode] = useState<ModalMode>('task');
  const [pickedProjectId, setPickedProjectId] = useState('');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [blockedReason, setBlockedReason] = useState('');
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
  const [meetingLink, setMeetingLink] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [reason, setReason] = useState('');

  const isEditing = Boolean(editingTask);
  // Only relevant in edit mode — an unowned task (or one the current user is already an assignee
  // of) still saves directly; anyone else's edit files a change_request instead (see
  // ProjectDetail's "คำขอที่รอดำเนินการ" panel for the owner-facing approve/reject side). งานย่อย
  // is exempt from this gate entirely — only the main task needs approval, per the product decision.
  const canEditDirectly = !editingTask || Boolean(editingTask.parentTaskId) || isOwner(editingTask.assigneeEmployeeIds, currentUserId);
  const pendingRequest = editingTask && !editingTask.parentTaskId
    ? changeRequests?.find((r) => r.entityType === 'project_task' && r.entityId === editingTask.id && r.status === 'pending')
    : undefined;

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
      setBlocked(editingTask.status === 'blocked');
      setBlockedReason(editingTask.blockedReason ?? '');
      setAssigneeIds(editingTask.assigneeEmployeeIds);
      setReviewerIds(editingTask.reviewerEmployeeIds ?? []);
      setStartDate(editingTask.startDateISO ?? '');
      setDueDate(editingTask.dueDateISO ?? '');
    } else {
      setTitle('');
      setDescription('');
      setPriority(null);
      setBlocked(false);
      setBlockedReason('');
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
    setMeetingLink('');
    setFormError('');
    setReason('');
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

  // Restricts the assignee/reviewer/attendee pickers below to people already on this project —
  // an empty roster (no owners/members set yet, or no project picked yet) leaves it open to
  // everyone, the same "unowned = open" convention the change-request ownership gate already uses.
  const projectMemberIdSet = useMemo(() => {
    const ids = needsProjectPicker
      ? [...(pickedProject?.ownerEmployeeIds ?? []), ...(pickedProject?.memberEmployeeIds ?? [])]
      : (projectMemberIds ?? []);
    return new Set(ids);
  }, [needsProjectPicker, pickedProject, projectMemberIds]);
  const selectableEmployees = (currentIds: string[]) =>
    projectMemberIdSet.size === 0 ? employees : employees.filter((e) => projectMemberIdSet.has(e.id) || currentIds.includes(e.id));

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

  const reasonValid = canEditDirectly || reason.trim() !== '';
  const blockedReasonValid = !blocked || blockedReason.trim() !== '';

  const isFormValid = effectiveProjectId !== '' && !pendingRequest && reasonValid && blockedReasonValid && (mode === 'task'
    ? titleValid && taskDateOrderValid && taskStartInRange && taskDueInRange
    : titleValid && meetingDate.trim() !== '' && meetingStartTime.trim() !== '' && meetingTimeOrderValid && meetingDateInRange);

  const resetAndClose = () => {
    setFormError('');
    onClose();
  };

  useEscapeToClose(isOpen, resetAndClose);

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
          meetingLink: meetingLink.trim() || undefined,
          createdBy: currentUserId,
          status: 'scheduled',
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
          // Derived from the process, not freely picked — see computeTaskStatus above.
          status: computeTaskStatus(editingTask?.status, assigneeIds, blocked),
          blockedReason: blocked ? blockedReason.trim() : undefined,
        };

        if (editingTask && onUpdateTask) {
          if (canEditDirectly) {
            await onUpdateTask(editingTask.id, taskFields);
          } else if (onRequestChange) {
            await onRequestChange('project_task', editingTask.id, 'edit', taskFields, reason.trim());
          }
        } else {
          // Created first (not the folder) so the real new task id exists to tag the folder with —
          // DocVault uses that tag to show "this belongs to task X" (see LinkedDoc.taskId).
          const createdTask = await onSave({
            projectId: effectiveProjectId,
            creatorEmployeeId: currentUserId,
            progress: 0,
            checklist: [],
            parentTaskId: parentTask?.id ?? null,
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

  // Shared between the task and meeting branches below, each pairing it with a different field
  // to fill out a balanced 2-column row instead of leaving it stranded alone in a wider modal.
  const creatorField = (
    <div>
      <label className="block text-[#272220] font-bold text-[11px] mb-1">ผู้สร้าง</label>
      <div className="flex items-center gap-2.5 p-2 text-sm border border-[#E5E5E5] rounded-lg bg-slate-50">
        {creator?.avatar ? (
          <img src={creator.avatar} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
        ) : (
          <EmployeeAvatar name={creator ? displayName(creator) : '?'} sizePx={28} />
        )}
        <span className="text-slate-700">{creator ? displayName(creator) : 'ไม่ทราบผู้ใช้งาน'}</span>
      </div>
    </div>
  );

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
            className="relative bg-white rounded-2xl shadow-[0px_12px_36px_-8px_rgba(0,0,0,0.12)] w-full max-w-2xl mx-4 max-h-[88vh] overflow-hidden flex flex-col"
          >
            <div className="flex justify-between items-center px-6 pt-5 pb-2 shrink-0">
              <div>
                <h3 className="text-sm font-bold text-slate-800">
                  {isEditing ? (editingTask?.parentTaskId ? 'แก้ไขงานย่อย' : 'แก้ไขงาน') : parentTask ? 'เพิ่มงานย่อย' : mode === 'task' ? 'เพิ่มงานใหม่' : 'นัดประชุมใหม่'}
                </h3>
                <p className="text-[11px] text-[#6F6F6F] mt-0.5">
                  {isEditing
                    ? 'ปรับรายละเอียดงานแล้วกดบันทึกเพื่อยืนยัน'
                    : parentTask
                    ? `งานย่อยของ "${parentTask.title}"`
                    : needsProjectPicker
                    ? 'เลือกโครงการแล้วกรอกรายละเอียดงาน'
                    : mode === 'task' ? 'กรอกรายละเอียดงานสำหรับโครงการนี้' : 'กรอกรายละเอียดการประชุมสำหรับโครงการนี้'}
                </p>
              </div>
              <button onClick={resetAndClose} className="text-slate-400 hover:text-slate-600 cursor-pointer" type="button">
                <X size={18} />
              </button>
            </div>

            {!isEditing && !needsProjectPicker && !parentTask && (
            <div className="flex items-center gap-1 px-6 pb-3 shrink-0">
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
              <div className="flex-1 min-h-0 overflow-y-auto px-6 pt-4 pb-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                <div className="sm:col-span-2">
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
                  <div className="sm:col-span-2">
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

                <div className="sm:col-span-2">
                  <label className="block text-[#272220] font-bold text-[11px] mb-1">รายละเอียด (ไม่บังคับ)</label>
                  <textarea
                    rows={3}
                    placeholder="อธิบายรายละเอียดของงานนี้..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full p-2.5 text-sm border border-[#E5E5E5] rounded-lg placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#FF6537]"
                  />
                </div>

                {mode === 'task' ? (
                  <>
                    {creatorField}

                    <div>
                      <label className="block text-[#272220] font-bold text-[11px] mb-1">ผู้รับผิดชอบ (เลือกได้มากกว่า 1)</label>
                      <EmployeeMultiSelect
                        employees={selectableEmployees(assigneeIds)}
                        valueIds={assigneeIds}
                        onChange={setAssigneeIds}
                        placeholder="ค้นหาหรือเลือกพนักงาน..."
                      />
                    </div>

                    <div>
                      <label className="block text-[#272220] font-bold text-[11px] mb-1">ผู้ตรวจงาน (ไม่บังคับ, เลือกได้มากกว่า 1)</label>
                      <EmployeeMultiSelect
                        employees={selectableEmployees(reviewerIds)}
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

                    {isEditing && editingTask && (
                      <div className="sm:col-span-2 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                        <div>
                          <p className="text-[#272220] font-bold text-[11px] mb-1">สถานะงาน</p>
                          <p className="text-[10px] text-[#A0A0A0]">
                            เปลี่ยนตามขั้นตอนอัตโนมัติ — ยังไม่เริ่ม/กำลังทำตามผู้รับผิดชอบ, รอตรวจ/เสร็จแล้วผ่านการ "ส่งงาน"/"ตรวจงาน"
                          </p>
                        </div>
                        {(() => {
                          const previewStatus = computeTaskStatus(editingTask.status, assigneeIds, blocked);
                          const color = TASK_STATUS_COLOR[previewStatus];
                          return (
                            <span
                              className="text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap shrink-0"
                              style={{ backgroundColor: `${color}1A`, color }}
                            >
                              {TASK_STATUS_LABEL[previewStatus]}
                            </span>
                          );
                        })()}
                      </div>
                    )}

                    {isEditing && editingTask?.status !== 'done' && (
                      <div className="sm:col-span-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={blocked}
                            onChange={(e) => setBlocked(e.target.checked)}
                            className="rounded border-[#E5E5E5] text-[#FF6537] focus:ring-[#FF6537] cursor-pointer"
                          />
                          <span className="text-[#272220] font-bold text-[11px]">ติดปัญหา</span>
                          <span className="text-[10px] text-[#A0A0A0]">— ทุกคนที่เกี่ยวข้องกับโปรเจคนี้จะได้รับแจ้งเตือน</span>
                        </label>
                        {blocked && (
                          <textarea
                            rows={2}
                            autoFocus
                            value={blockedReason}
                            onChange={(e) => setBlockedReason(e.target.value)}
                            placeholder="ติดปัญหาอะไร? (บังคับกรอก — จะโชว์ให้คนอื่นเห็นด้วย)"
                            className="w-full mt-2 p-2.5 text-sm border border-[#E5E5E5] rounded-lg placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#FF6537]"
                          />
                        )}
                      </div>
                    )}

                    {isEditing && pendingRequest && (
                      <p className="sm:col-span-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        มีคำขอแก้ไขรออนุมัติอยู่แล้ว โดย {(() => {
                          const requester = employees.find((e) => e.id === pendingRequest.requestedBy);
                          return requester ? displayName(requester) : 'ไม่ทราบผู้ใช้งาน';
                        })()}
                        {' — เหตุผล: '}{pendingRequest.reason}
                      </p>
                    )}

                    {isEditing && !pendingRequest && !canEditDirectly && (
                      <div className="sm:col-span-2">
                        <label className="block text-[#272220] font-bold text-[11px] mb-1">
                          เหตุผลที่ขอแก้ไข <span className="text-[#FF6537]">*</span>
                        </label>
                        <textarea
                          rows={2}
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          placeholder="งานนี้มีผู้รับผิดชอบแล้ว ระบุเหตุผลเพื่อขออนุมัติแก้ไข..."
                          className="w-full p-2.5 text-sm border border-[#E5E5E5] rounded-lg placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#FF6537]"
                        />
                      </div>
                    )}

                    <div className="sm:col-span-2">
                      <label className="block text-[#272220] font-bold text-[11px] mb-1">ระยะเวลา</label>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[#A0A0A0] text-[10px] mb-1">วันที่เริ่ม</label>
                          <ThaiDatePicker
                            value={startDate}
                            onChange={setStartDate}
                            min={effectiveProjectStartDate || undefined}
                            max={effectiveProjectEndDate || undefined}
                            hasError={!taskStartInRange}
                          />
                        </div>
                        <div>
                          <label className="block text-[#A0A0A0] text-[10px] mb-1">กำหนดส่ง</label>
                          <ThaiDatePicker
                            value={dueDate}
                            onChange={setDueDate}
                            min={startDate || effectiveProjectStartDate || undefined}
                            max={effectiveProjectEndDate || undefined}
                            hasError={!taskDateOrderValid || !taskDueInRange}
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
                    <div className="sm:col-span-2 border-t border-slate-100 pt-3">
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
                    <div className="sm:col-span-2">
                      <label className="block text-[#272220] font-bold text-[11px] mb-1">
                        วัน-เวลานัดประชุม <span className="text-[#FF6537]">*</span>
                      </label>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-1">
                          <label className="block text-[#A0A0A0] text-[10px] mb-1">วันที่</label>
                          <ThaiDatePicker
                            value={meetingDate}
                            onChange={setMeetingDate}
                            min={effectiveProjectStartDate || undefined}
                            max={effectiveProjectEndDate || undefined}
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

                    {creatorField}

                    <div>
                      <label className="block text-[#272220] font-bold text-[11px] mb-1">ผู้เข้าร่วมประชุม (ไม่บังคับ)</label>
                      <EmployeeMultiSelect
                        employees={selectableEmployees(attendeeIds)}
                        valueIds={attendeeIds}
                        onChange={setAttendeeIds}
                        placeholder="ค้นหาหรือเลือกพนักงาน..."
                      />
                    </div>

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
                  </>
                )}

                {formError && (
                  <p className="sm:col-span-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{formError}</p>
                )}
              </div>
              </div>

              <div className="shrink-0 px-6 pt-4 pb-5 flex items-center gap-3">
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
                  {isEditing && !canEditDirectly
                    ? (isSubmitting ? 'กำลังส่งคำขอ...' : 'ส่งคำขอแก้ไข')
                    : isSubmitting ? 'กำลังบันทึก...' : isEditing ? 'บันทึกการแก้ไข' : mode === 'task' ? 'เพิ่มงาน' : 'นัดประชุม'}
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
