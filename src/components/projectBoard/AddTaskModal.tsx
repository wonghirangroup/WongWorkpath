import { useState, useEffect, useMemo, FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { X, Folder, ListChecks, Users2, Layers, Paperclip, Link2, Trash2 } from 'lucide-react';
import { Employee, LinkedDoc, Meeting } from '../../types';
import { ProjectRow, ProjectTaskItem, ProjectTaskStatus } from './types';
import { EmployeeMultiSelect, displayName, formatThaiDateShort, PRIORITY_OPTIONS, Priority } from './CreateProjectModal';
import { TASK_STATUS_LABEL, TASK_STATUS_COLOR } from './statusMeta';
import { ApiError, ChangeRequest } from '../../lib/api';
import { isOwner, resolveValidIds } from '../../lib/ownership';
import { readFileAsDataUrl, MAX_FILE_BYTES, formatFileSize, getItemVisual, suggestLinkName } from '../DocVault';
import { nowTimestamp } from '../../lib/datetime';
import Dropdown from '../Dropdown';
import EmployeeAvatar from '../EmployeeAvatar';
import ThaiDatePicker from '../ThaiDatePicker';
import { useEscapeToClose } from '../../lib/useEscapeToClose';
import { useConfirm } from '../../context/ConfirmContext';

// 'topic' ("หัวข้อ") is not a separate stored entity — it's the exact same ProjectTaskItem as
// 'task', just created through a differently-labeled tab for a task the user intends to hold
// subtasks (e.g. "เบิกทุน NIA"). Its status then auto-derives from its subtasks once any exist
// (see project-tasks.ts's recomputeAncestorStatuses) — nothing here needs to know which tab the
// task was originally created from after that point.
type ModalMode = 'task' | 'topic' | 'meeting';

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
  onCreateFolder: (name: string, parentId: string | null, taskId: string | undefined, projectId: string) => Promise<string>;
  // Needed to find a parent task's own folder (for the folder-nesting rule below) and to render
  // "already attached" state consistently with the rest of the app — same documents array every
  // other modal that touches Doc Vault already receives.
  documents: LinkedDoc[];
  onAddDocument: (doc: Omit<LinkedDoc, 'id'>) => Promise<LinkedDoc>;
  currentUserName: string;
  // The current project's own tasks (unfiltered) — powers the "ผูกกับงาน" picker shown in
  // meeting mode, scoped to just this project like every other picker in this modal.
  tasks?: ProjectTaskItem[];
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
  // ผู้บริหาร bypasses the owner-approval gate below regardless of whether they're actually an
  // assignee of the task being edited.
  isExecutive?: boolean;
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
export default function AddTaskModal({ isOpen, onClose, onSave, onAddMeeting, onUpdateTask, onCreateFolder, documents, onAddDocument, currentUserName, tasks, projectId, projectDocFolderId, projectStartDate, projectEndDate, projects, projectMemberIds, employees, currentUserId, isExecutive, editingTask, parentTask, changeRequests, onRequestChange }: AddTaskModalProps) {
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
  // Tracks whether the user has typed into the folder-name field themselves — while untouched, it
  // keeps mirroring the task title as it's typed; once touched, it stops so a manual edit doesn't
  // get clobbered by the next keystroke in the title field above it.
  const [folderNameTouched, setFolderNameTouched] = useState(false);

  const [meetingDate, setMeetingDate] = useState('');
  const [meetingStartTime, setMeetingStartTime] = useState('');
  const [meetingEndTime, setMeetingEndTime] = useState('');
  const [meetingTaskId, setMeetingTaskId] = useState('');
  const [attendeeIds, setAttendeeIds] = useState<string[]>([]);
  const [location, setLocation] = useState('');
  const [locationLink, setLocationLink] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [reason, setReason] = useState('');

  // Files/links to attach at creation time (a description's supporting material) — same shape and
  // upload flow as SubmitTaskModal's own attachment picker, just running at creation instead of at
  // submission. Create-only, same as "สร้างโฟลเดอร์" above: re-offering this on every edit-save
  // would re-attach the same picks with no way to tell they were already saved.
  const [pickedFiles, setPickedFiles] = useState<globalThis.File[]>([]);
  const [pickedLinks, setPickedLinks] = useState<{ name: string; url: string }[]>([]);
  const [linkUrl, setLinkUrl] = useState('');
  const [fileError, setFileError] = useState('');

  const isEditing = Boolean(editingTask);
  // Only relevant in edit mode — an unowned task (or one the current user is already an assignee
  // of) still saves directly; anyone else's edit files a change_request instead (see
  // ProjectDetail's "คำขอที่รอดำเนินการ" panel for the owner-facing approve/reject side). งานย่อย
  // is exempt from this gate entirely — only the main task needs approval, per the product decision.
  const canEditDirectly = Boolean(isExecutive) || !editingTask || Boolean(editingTask.parentTaskId) || isOwner(resolveValidIds(editingTask.assigneeEmployeeIds, employees), currentUserId);
  // A "หัวข้อ" (or any task with 1+ subtasks) has its status fully derived server-side — see
  // project-tasks.ts's recomputeAncestorStatuses — manual status/ติดปัญหา controls are hidden
  // here rather than left to silently no-op against the server's own override.
  const hasSubtasks = Boolean(editingTask && tasks?.some((t) => t.parentTaskId === editingTask.id));
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
    setFolderNameTouched(false);
    setMeetingDate('');
    setMeetingStartTime('');
    setMeetingEndTime('');
    setMeetingTaskId('');
    setAttendeeIds([]);
    setLocation('');
    setLocationLink('');
    setMeetingLink('');
    setPickedFiles([]);
    setPickedLinks([]);
    setLinkUrl('');
    setFileError('');
    setFormError('');
    setReason('');
  }, [isOpen, editingTask]);

  // "สร้างโฟลเดอร์เอกสาร" defaults to checked (see the reset effect above) — this keeps the folder
  // name synced to the task title as it's typed, the same "only if not already set" rule the
  // checkbox's own onChange used before it defaulted to checked at all.
  useEffect(() => {
    if (!isEditing && createFolder && !folderNameTouched) setFolderName(title.trim());
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

  const projectRootDocFolderId = needsProjectPicker ? pickedProject?.docFolderId : projectDocFolderId;
  // A subtask's own new folder (and any file/link attached without checking "สร้างโฟลเดอร์") nests
  // inside its PARENT TASK's own folder, not the project root — whatever context a task was
  // created from is where its stuff lives, same rule at every level of nesting. Falls back to the
  // project root when the parent task happens to have no folder of its own yet.
  const parentTaskFolder = parentTask ? documents.find((d) => d.kind === 'folder' && d.taskId === parentTask.id) : undefined;
  const effectiveProjectDocFolderId = parentTask ? (parentTaskFolder?.id ?? projectRootDocFolderId) : projectRootDocFolderId;
  const effectiveProjectStartDate = needsProjectPicker ? pickedProject?.startDateISO : projectStartDate;
  const effectiveProjectEndDate = needsProjectPicker ? pickedProject?.endDateISO : projectEndDate;
  // งาน/หัวข้อ within the current project, pickable as what a new meeting is about — excludes the
  // meeting's own project-level option (projectId with no taskId is already the default/unset state).
  const tasksForMeetingPicker = (tasks ?? []).filter((t) => t.projectId === effectiveProjectId);

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

  const isFormValid = effectiveProjectId !== '' && !pendingRequest && reasonValid && blockedReasonValid && (mode !== 'meeting'
    ? titleValid && taskDateOrderValid && taskStartInRange && taskDueInRange
    : titleValid && meetingDate.trim() !== '' && meetingStartTime.trim() !== '' && meetingTimeOrderValid && meetingDateInRange);

  const resetAndClose = () => {
    setFormError('');
    onClose();
  };

  useEscapeToClose(isOpen, resetAndClose);
  const confirm = useConfirm();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isFormValid || isSubmitting) return;

    // Only an edit of an existing task asks first — creating a new task/meeting isn't an edit or delete.
    if (mode !== 'meeting' && editingTask && onUpdateTask) {
      const confirmed = await confirm({
        title: canEditDirectly ? 'ยืนยันการบันทึกการแก้ไขงาน?' : 'ยืนยันการส่งคำขอแก้ไขงาน?',
        message: canEditDirectly ? `บันทึกการแก้ไขงาน "${title.trim()}"` : `ส่งคำขอแก้ไขงาน "${title.trim()}" ให้ผู้รับผิดชอบพิจารณา`,
        confirmLabel: canEditDirectly ? 'บันทึก' : 'ส่งคำขอ',
      });
      if (!confirmed) return;
    }

    setFormError('');
    setIsSubmitting(true);
    try {
      if (mode === 'meeting') {
        await onAddMeeting({
          projectId: effectiveProjectId,
          taskId: meetingTaskId || undefined,
          title: title.trim(),
          description: description.trim() || undefined,
          date: meetingDate,
          startTime: meetingStartTime,
          endTime: meetingEndTime || undefined,
          attendeeIds,
          location: location.trim() || undefined,
          locationLink: locationLink.trim() || undefined,
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
          let newFolderId: string | undefined;
          if (createFolder && folderName.trim()) {
            newFolderId = await onCreateFolder(folderName.trim(), effectiveProjectDocFolderId ?? null, createdTask.id, createdTask.projectId);
          }
          // Any file/link attached here goes inside this task's own brand-new folder when one was
          // just created (it's specifically this task's own space); otherwise it falls back to
          // whatever folder-nesting rule effectiveProjectDocFolderId already resolved above — the
          // project's root, or the parent task's own folder when this is a subtask.
          if (pickedFiles.length > 0 || pickedLinks.length > 0) {
            const attachParentId = newFolderId ?? effectiveProjectDocFolderId ?? null;
            const date = nowTimestamp();
            for (const file of pickedFiles) {
              const dataUrl = await readFileAsDataUrl(file);
              await onAddDocument({
                name: file.name,
                kind: 'file',
                parentId: attachParentId,
                taskId: createdTask.id,
                fileDataUrl: dataUrl,
                fileMimeType: file.type || 'application/octet-stream',
                fileSize: file.size,
                scope: 'โครงการ',
                projectId: createdTask.projectId,
                creatorEmployeeId: currentUserId,
                version: 1,
                lastUpdated: date,
                updatedBy: currentUserName,
                history: [{ version: 1, updatedBy: currentUserName, date, note: 'แนบไฟล์ตอนสร้างงาน' }],
              });
            }
            for (const link of pickedLinks) {
              await onAddDocument({
                name: link.name,
                kind: 'link',
                parentId: attachParentId,
                taskId: createdTask.id,
                url: link.url,
                scope: 'โครงการ',
                projectId: createdTask.projectId,
                creatorEmployeeId: currentUserId,
                version: 1,
                lastUpdated: date,
                updatedBy: currentUserName,
                history: [{ version: 1, updatedBy: currentUserName, date, note: 'แนบลิงก์ตอนสร้างงาน' }],
              });
            }
          }
        }
      }
      resetAndClose();
    } catch (err) {
      setFormError(
        err instanceof ApiError
          ? err.message
          : mode === 'meeting' ? 'นัดประชุมไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' : isEditing ? 'บันทึกการแก้ไขไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' : 'เพิ่มงานไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'
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
      {/* Fixed to the same 42px as every text input beside it (the 28px avatar plus padding made this
          one 4px taller, which pushed the whole row below it out of line with the other column). */}
      <div className="flex items-center gap-2.5 h-10.5 px-2.5 text-sm border border-[#E5E5E5] rounded-lg bg-slate-50">
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
            role="dialog" aria-modal="true" aria-label="เพิ่มงานใหม่" className="relative bg-white rounded-2xl shadow-[0px_12px_36px_-8px_rgba(0,0,0,0.12)] w-full max-w-2xl lg:max-w-6xl mx-4 max-h-[94vh] overflow-hidden flex flex-col"
          >
            <div className="flex justify-between items-center px-6 pt-5 pb-2 shrink-0">
              <div>
                <h3 className="text-sm font-bold text-slate-800">
                  {isEditing
                    ? (editingTask?.parentTaskId ? 'แก้ไขงานย่อย' : 'แก้ไขงาน')
                    : parentTask
                    ? 'เพิ่มงานย่อย'
                    : mode === 'task'
                    ? 'เพิ่มงานใหม่'
                    : mode === 'topic'
                    ? 'เพิ่มหัวข้อใหม่'
                    : 'นัดประชุมใหม่'}
                </h3>
                <p className="text-[11px] text-[#6F6F6F] mt-0.5">
                  {isEditing
                    ? 'ปรับรายละเอียดงานแล้วกดบันทึกเพื่อยืนยัน'
                    : parentTask
                    ? `งานย่อยของ "${parentTask.title}"`
                    : needsProjectPicker
                    ? 'เลือกโครงการแล้วกรอกรายละเอียดงาน'
                    : mode === 'task'
                    ? 'กรอกรายละเอียดงานสำหรับโครงการนี้'
                    : mode === 'topic'
                    ? 'สร้างหัวข้อไว้ก่อน แล้วค่อยเพิ่มงานย่อยจากหัวข้อนี้ทีหลัง'
                    : 'กรอกรายละเอียดการประชุมสำหรับโครงการนี้'}
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
                onClick={() => setMode('topic')}
                className={`flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                  mode === 'topic' ? 'bg-[#FFF1EC] text-[#FF6537]' : 'text-[#6F6F6F] hover:bg-slate-50'
                }`}
              >
                <Layers size={13} /> หัวข้อ
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
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-3 items-stretch">
                {/* Left column: what the thing is (title/description) plus the status/folder bits tied to it.
                    Right column: who and when. Stacks into one column below lg, where the body scrolls instead.
                    The left column is a flex column whose รายละเอียด box absorbs any height the right column
                    has extra (the meeting form's right side is a good deal taller), so both columns end
                    together in every mode instead of the left trailing off into empty space. */}
                <div className="flex flex-col gap-3 min-w-0">
                  <div className="sm:col-span-2">
                    <label className="block text-[#272220] font-bold text-[11px] mb-1">
                      {mode === 'task' ? 'ชื่องาน' : mode === 'topic' ? 'ชื่อหัวข้อ' : 'ชื่อการประชุม'} <span className="text-[#FF6537]">*</span>
                    </label>
                    <input
                      type="text"
                      autoFocus
                      placeholder={mode === 'task' ? 'เช่น ออกแบบหน้าร้านใหม่' : mode === 'topic' ? 'เช่น เบิกทุน NIA' : 'เช่น ประชุมทบทวนความคืบหน้าโครงการ'}
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

                  <div className="flex flex-col flex-1 min-h-0">
                    <label className="block text-[#272220] font-bold text-[11px] mb-1">รายละเอียด (ไม่บังคับ)</label>
                    <textarea
                      rows={2}
                      placeholder="อธิบายรายละเอียดของงานนี้..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full flex-1 min-h-20 lg:min-h-16 resize-none p-2.5 text-sm border border-[#E5E5E5] rounded-lg placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#FF6537]"
                    />
                  </div>
                  {mode !== 'meeting' ? (
                    <>
                        {isEditing && editingTask && (
                          <div className="sm:col-span-2 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                            <div>
                              <p className="text-[#272220] font-bold text-[11px] mb-1">สถานะงาน</p>
                              <p className="text-[11px] text-[#767676]">
                                {hasSubtasks
                                  ? 'งานนี้มีงานย่อยแล้ว — สถานะคำนวณอัตโนมัติจากงานย่อยทั้งหมด (ดำเนินการอยู่จนกว่างานย่อยทุกงานจะเสร็จ) ไม่สามารถแก้ไขเองได้'
                                  : 'เปลี่ยนตามขั้นตอนอัตโนมัติ — ยังไม่เริ่ม/กำลังทำตามผู้รับผิดชอบ, รอตรวจ/เสร็จแล้วผ่านการ "ส่งงาน"/"ตรวจงาน"'}
                              </p>
                            </div>
                            {(() => {
                              const previewStatus = hasSubtasks ? editingTask.status : computeTaskStatus(editingTask.status, assigneeIds, blocked);
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

                        {isEditing && !hasSubtasks && editingTask?.status !== 'done' && (
                          <div className="sm:col-span-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={blocked}
                                onChange={(e) => setBlocked(e.target.checked)}
                                className="rounded border-[#E5E5E5] text-[#FF6537] focus:ring-[#FF6537] cursor-pointer"
                              />
                              <span className="text-[#272220] font-bold text-[11px]">ติดปัญหา</span>
                              <span className="text-[11px] text-[#767676]">— ทุกคนที่เกี่ยวข้องกับโปรเจคนี้จะได้รับแจ้งเตือน</span>
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

                        {!isEditing && (
                        <div>
                          <label className="flex items-center gap-2 cursor-pointer mb-1">
                            <input
                              type="checkbox"
                              checked={createFolder}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setCreateFolder(checked);
                                if (checked && !folderNameTouched) setFolderName(title.trim());
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
                              onChange={(e) => { setFolderName(e.target.value); setFolderNameTouched(true); }}
                              className="w-full p-2.5 text-sm border border-[#E5E5E5] rounded-lg placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#FF6537]"
                            />
                          )}
                        </div>
                        )}
                    </>
                  ) : (
                    <>
                        {tasksForMeetingPicker.length > 0 && (
                          <div className="sm:col-span-2">
                            <label className="block text-[#272220] font-bold text-[11px] mb-1">ผูกกับงาน (ไม่บังคับ)</label>
                            <Dropdown
                              value={meetingTaskId}
                              onChange={setMeetingTaskId}
                              placeholder="ไม่ผูกกับงานใดเป็นการเฉพาะ — ประชุมของทั้งโครงการ"
                              options={tasksForMeetingPicker.map((t) => ({ value: t.id, label: t.title }))}
                            />
                          </div>
                        )}
                    </>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 content-start gap-x-4 gap-y-3 min-w-0">
                  {mode !== 'meeting' ? (
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
                        </div>

                        <div>
                          <label className="block text-[#272220] font-bold text-[11px] mb-1">ระดับความสำคัญ (ไม่บังคับ)</label>
                          <div className="flex gap-2">
                            {PRIORITY_OPTIONS.map((p) => (
                              <button
                                key={p.value}
                                type="button"
                                onClick={() => setPriority((current) => (current === p.value ? null : p.value))}
                                className={`flex-1 h-10.5 rounded-lg text-xs font-semibold border cursor-pointer transition-colors ${
                                  priority === p.value ? p.activeClass : 'border-[#E5E5E5] text-[#6F6F6F] hover:bg-slate-50'
                                }`}
                              >
                                {p.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <p className="sm:col-span-2 -mt-1.5 text-[11px] text-[#767676]">ผู้ตรวจคนใดคนหนึ่งกดผ่าน/ตีกลับก็มีผลทันที ถ้ายังไม่เลือกตอนนี้ เลือกได้อีกครั้งตอนกด "ส่งงาน"</p>

                        <div>
                          <label className="block text-[#272220] font-bold text-[11px] mb-1">วันที่เริ่ม</label>
                          <ThaiDatePicker
                            value={startDate}
                            onChange={setStartDate}
                            min={effectiveProjectStartDate || undefined}
                            max={effectiveProjectEndDate || undefined}
                            hasError={!taskStartInRange}
                          />
                        </div>
                        <div>
                          <label className="block text-[#272220] font-bold text-[11px] mb-1">กำหนดส่ง</label>
                          <ThaiDatePicker
                            value={dueDate}
                            onChange={setDueDate}
                            min={startDate || effectiveProjectStartDate || undefined}
                            max={effectiveProjectEndDate || undefined}
                            hasError={!taskDateOrderValid || !taskDueInRange}
                          />
                        </div>
                        {!taskDateOrderValid && (
                          <p className="sm:col-span-2 -mt-1.5 text-xs text-red-600">กำหนดส่งต้องไม่อยู่ก่อนวันที่เริ่ม</p>
                        )}
                        {taskDateOrderValid && (!taskStartInRange || !taskDueInRange) && projectRangeLabel && (
                          <p className="sm:col-span-2 -mt-1.5 text-xs text-red-600">วันที่ของงาน{projectRangeLabel}</p>
                        )}
                    </>
                  ) : (
                    <>
                        <div className="sm:col-span-2 grid grid-cols-3 gap-3">
                          <div>
                            <label className="block text-[#272220] font-bold text-[11px] mb-1">วันที่ <span className="text-[#FF6537]">*</span></label>
                            <ThaiDatePicker
                              value={meetingDate}
                              onChange={setMeetingDate}
                              min={effectiveProjectStartDate || undefined}
                              max={effectiveProjectEndDate || undefined}
                              hasError={!meetingDateInRange}
                            />
                          </div>
                          <div>
                            <label className="block text-[#272220] font-bold text-[11px] mb-1">เวลาเริ่ม <span className="text-[#FF6537]">*</span></label>
                            <input
                              type="time"
                              value={meetingStartTime}
                              onChange={(e) => setMeetingStartTime(e.target.value)}
                              className="w-full p-2.5 text-sm border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#FF6537]"
                            />
                          </div>
                          <div>
                            <label className="block text-[#272220] font-bold text-[11px] mb-1">เวลาสิ้นสุด</label>
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
                          <p className="sm:col-span-2 -mt-1.5 text-xs text-red-600">เวลาสิ้นสุดต้องไม่อยู่ก่อนเวลาเริ่ม</p>
                        )}
                        {meetingTimeOrderValid && !meetingDateInRange && projectRangeLabel && (
                          <p className="sm:col-span-2 -mt-1.5 text-xs text-red-600">วันที่ประชุม{projectRangeLabel}</p>
                        )}

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
                          <label className="block text-[#272220] font-bold text-[11px] mb-1">ลิงก์แผนที่ (ไม่บังคับ)</label>
                          <input
                            type="text"
                            placeholder="เช่น https://maps.google.com/..."
                            value={locationLink}
                            onChange={(e) => setLocationLink(e.target.value)}
                            className="w-full p-2.5 text-sm border border-[#E5E5E5] rounded-lg placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#FF6537]"
                          />
                        </div>

                        <div className="sm:col-span-2">
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
                </div>

                {mode !== 'meeting' && (
                  <>
                    {!isEditing && (
                    <div className="lg:col-span-2 border-t border-slate-100 pt-3">
                      <label className="block text-[#272220] font-bold text-[11px] mb-1">
                        ไฟล์แนบ/ลิงก์ประกอบ (ไม่บังคับ) <span className="font-normal text-[#767676]">— ไม่เกิน {formatFileSize(MAX_FILE_BYTES)} ต่อไฟล์</span>
                      </label>
                      {/* File picker and link field sit side by side (stacked below sm) so this
                          row costs one line of height instead of two. */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 lg:gap-x-6">
                      <div className="flex gap-2">
                        <label className="flex-1 flex items-center gap-2 justify-center h-10 px-3 border border-dashed border-[#E5E5E5] rounded-lg cursor-pointer hover:bg-slate-50 text-xs text-[#6F6F6F]">
                          <Paperclip size={14} />
                          แนบไฟล์
                          <input
                            type="file"
                            multiple
                            className="hidden"
                            onChange={(e) => {
                              setFileError('');
                              // Copy into a plain array BEFORE resetting the input — e.target.files is a
                              // live FileList, so clearing value first empties it and nothing gets attached.
                              const pickedNow = e.target.files ? Array.from(e.target.files) : [];
                              e.target.value = '';
                              if (pickedNow.length === 0) return;
                              const oversized: string[] = [];
                              const accepted: globalThis.File[] = [];
                              pickedNow.forEach((f) => {
                                if (f.size > MAX_FILE_BYTES) oversized.push(f.name);
                                else accepted.push(f);
                              });
                              if (oversized.length > 0) setFileError(`ไฟล์ใหญ่เกิน ${formatFileSize(MAX_FILE_BYTES)} ถูกข้าม: ${oversized.join(', ')}`);
                              setPickedFiles((prev) => [...prev, ...accepted]);
                            }}
                          />
                        </label>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="url"
                          value={linkUrl}
                          onChange={(e) => setLinkUrl(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key !== 'Enter') return;
                            e.preventDefault();
                            const url = linkUrl.trim();
                            if (!url) return;
                            setPickedLinks((prev) => [...prev, { name: suggestLinkName(url) || url, url }]);
                            setLinkUrl('');
                          }}
                          placeholder="แปะลิงก์ที่นี่แล้วกด + เพื่อแนบ..."
                          className="flex-1 min-w-0 p-2.5 text-xs border border-[#E5E5E5] rounded-lg placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#FF6537]"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const url = linkUrl.trim();
                            if (!url) return;
                            setPickedLinks((prev) => [...prev, { name: suggestLinkName(url) || url, url }]);
                            setLinkUrl('');
                          }}
                          disabled={!linkUrl.trim()}
                          className="w-10 h-10 shrink-0 rounded-lg border border-[#E5E5E5] text-[#6F6F6F] hover:bg-slate-50 flex items-center justify-center cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <Link2 size={15} />
                        </button>
                      </div>
                      </div>
                      {fileError && <p className="text-xs text-red-600 mt-1.5">{fileError}</p>}

                      {(pickedFiles.length > 0 || pickedLinks.length > 0) && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 lg:gap-x-6 mt-2">
                          {pickedFiles.map((f, idx) => {
                            const { Icon, color } = getItemVisual({ kind: 'file', name: f.name, fileMimeType: f.type });
                            return (
                              <div key={`file-${idx}`} className="flex items-center gap-2 px-2 py-1.5 border border-[#FFD9C7] rounded-xl bg-[#FFF1EC]">
                                <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center shrink-0">
                                  <Icon size={15} className={color} />
                                </div>
                                {/* Name and size share one line — a second line per chip is what pushed
                                    a handful of attachments past the modal's no-scroll height. */}
                                <p className="min-w-0 flex-1 truncate text-xs font-medium text-[#272220]">
                                  {f.name} <span className="font-normal text-[11px] text-[#767676]">{formatFileSize(f.size)}</span>
                                </p>
                                <button
                                  type="button"
                                  onClick={() => setPickedFiles((prev) => prev.filter((_, i) => i !== idx))}
                                  className="text-slate-400 hover:text-red-600 cursor-pointer shrink-0"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            );
                          })}
                          {pickedLinks.map((link, idx) => {
                            const { Icon, color } = getItemVisual({ kind: 'link', name: link.name });
                            return (
                              <div key={`link-${idx}`} className="flex items-center gap-2 px-2 py-1.5 border border-[#FFD9C7] rounded-xl bg-[#FFF1EC]">
                                <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center shrink-0">
                                  <Icon size={15} className={color} />
                                </div>
                                <p className="min-w-0 flex-1 truncate text-xs font-medium text-[#272220]" title={link.url}>
                                  {link.name} <span className="font-normal text-[11px] text-[#767676]">{link.url}</span>
                                </p>
                                <button
                                  type="button"
                                  onClick={() => setPickedLinks((prev) => prev.filter((_, i) => i !== idx))}
                                  className="text-slate-400 hover:text-red-600 cursor-pointer shrink-0"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    )}
                  </>
                )}

                {formError && (
                  <p className="lg:col-span-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{formError}</p>
                )}
              </div>
              </div>

              <div className="shrink-0 px-6 pt-3 pb-4 flex items-center gap-3">
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
                    : isSubmitting
                    ? 'กำลังบันทึก...'
                    : isEditing
                    ? 'บันทึกการแก้ไข'
                    : mode === 'task'
                    ? 'เพิ่มงาน'
                    : mode === 'topic'
                    ? 'สร้างหัวข้อ'
                    : 'นัดประชุม'}
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
