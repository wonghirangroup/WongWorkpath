import { useState, FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { X, Folder, ListChecks, Users2 } from 'lucide-react';
import { Employee, Meeting } from '../../types';
import { ProjectTaskItem } from './types';
import { EmployeeSearchSelect, EmployeeMultiSelect, displayName, formatThaiDateShort, PRIORITY_OPTIONS, Priority } from './CreateProjectModal';
import { getAvatarColor } from '../../lib/avatarColor';

type ModalMode = 'task' | 'meeting';

interface AddTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: ProjectTaskItem) => void;
  onAddMeeting: (meeting: Omit<Meeting, 'id'>) => void;
  onCreateFolder: (name: string) => void;
  projectId: string;
  employees: Employee[];
  currentUserId: string;
}

// UI-only, matching the Project Board's own create-project modal: appends to the project
// detail's local mock task list (not wired into AppDataContext) rather than persisting anywhere.
// The "create a folder" option is the exception — it really does write to the shared document
// store via onCreateFolder, same as CreateProjectModal's own folder step. A meeting created here
// *is* real, persisted data (see AppDataContext's handleAddMeeting) since it also needs to show
// up on the separate Calendar page, not just this project's own tab.
export default function AddTaskModal({ isOpen, onClose, onSave, onAddMeeting, onCreateFolder, projectId, employees, currentUserId }: AddTaskModalProps) {
  const [mode, setMode] = useState<ModalMode>('task');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority | null>(null);
  const [assigneeId, setAssigneeId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [createFolder, setCreateFolder] = useState(false);
  const [folderName, setFolderName] = useState('');

  const [meetingDate, setMeetingDate] = useState('');
  const [meetingStartTime, setMeetingStartTime] = useState('');
  const [meetingEndTime, setMeetingEndTime] = useState('');
  const [attendeeIds, setAttendeeIds] = useState<string[]>([]);
  const [location, setLocation] = useState('');

  const creator = employees.find((e) => e.id === currentUserId);
  const titleValid = title.trim() !== '';
  const isFormValid = mode === 'task' ? titleValid : titleValid && meetingDate.trim() !== '' && meetingStartTime.trim() !== '';

  const resetAndClose = () => {
    setMode('task');
    setTitle('');
    setDescription('');
    setPriority(null);
    setAssigneeId('');
    setStartDate('');
    setDueDate('');
    setCreateFolder(false);
    setFolderName('');
    setMeetingDate('');
    setMeetingStartTime('');
    setMeetingEndTime('');
    setAttendeeIds([]);
    setLocation('');
    onClose();
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    if (mode === 'meeting') {
      onAddMeeting({
        projectId,
        title: title.trim(),
        description: description.trim() || undefined,
        date: meetingDate,
        startTime: meetingStartTime,
        endTime: meetingEndTime || undefined,
        attendeeIds,
        location: location.trim() || undefined,
        createdBy: currentUserId,
      });
      resetAndClose();
      return;
    }

    let daysUntilDue: number | undefined;
    if (dueDate) {
      const diffMs = new Date(dueDate).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0);
      daysUntilDue = Math.round(diffMs / (1000 * 60 * 60 * 24));
    }

    if (createFolder && folderName.trim()) onCreateFolder(folderName.trim());

    onSave({
      id: `t${Date.now()}`,
      projectId,
      title: title.trim(),
      description: description.trim() || undefined,
      status: 'todo',
      priority: priority ?? undefined,
      assigneeEmployeeId: assigneeId,
      creatorEmployeeId: currentUserId,
      startDate: startDate ? formatThaiDateShort(startDate) : null,
      dueDate: dueDate ? formatThaiDateShort(dueDate) : null,
      daysUntilDue,
      progress: 0,
      checklist: [],
    });
    resetAndClose();
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
                <h3 className="text-sm font-bold text-slate-800">{mode === 'task' ? 'เพิ่มงานใหม่' : 'นัดประชุมใหม่'}</h3>
                <p className="text-[11px] text-[#6F6F6F] mt-0.5">
                  {mode === 'task' ? 'กรอกรายละเอียดงานสำหรับโครงการนี้' : 'กรอกรายละเอียดการประชุมสำหรับโครงการนี้'}
                </p>
              </div>
              <button onClick={resetAndClose} className="text-slate-400 hover:text-slate-600 cursor-pointer" type="button">
                <X size={18} />
              </button>
            </div>

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
                      <label className="block text-[#272220] font-bold text-[11px] mb-1">ใครรับผิดชอบ</label>
                      <EmployeeSearchSelect
                        employees={employees}
                        valueId={assigneeId}
                        onChange={setAssigneeId}
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
                      <label className="block text-[#272220] font-bold text-[11px] mb-1">ระยะเวลา</label>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[#A0A0A0] text-[10px] mb-1">วันที่เริ่ม</label>
                          <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full p-2.5 text-sm border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#FF6537]"
                          />
                        </div>
                        <div>
                          <label className="block text-[#A0A0A0] text-[10px] mb-1">กำหนดส่ง</label>
                          <input
                            type="date"
                            value={dueDate}
                            onChange={(e) => setDueDate(e.target.value)}
                            className="w-full p-2.5 text-sm border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#FF6537]"
                          />
                        </div>
                      </div>
                    </div>

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
                        <span className="text-[#272220] font-bold text-[11px]">สร้างโฟลเดอร์เอกสารใน &quot;เอกสาร Drive&quot; (ไม่บังคับ)</span>
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
                            onChange={(e) => setMeetingDate(e.target.value)}
                            className="w-full p-2.5 text-sm border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#FF6537]"
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
                            className="w-full p-2.5 text-sm border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#FF6537]"
                          />
                        </div>
                      </div>
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
                  disabled={!isFormValid}
                  className={`flex-1 h-10 text-white font-bold text-sm rounded-lg transition-colors ${
                    isFormValid ? 'bg-[#FF6537] hover:bg-[#e6572c] cursor-pointer' : 'bg-[#F68C6C] cursor-not-allowed'
                  }`}
                >
                  {mode === 'task' ? 'เพิ่มงาน' : 'นัดประชุม'}
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
