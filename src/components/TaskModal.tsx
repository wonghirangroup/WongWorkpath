import React, { useState, useEffect } from 'react';
import { Task, Employee, LinkedDoc, Priority, TaskStatus } from '../types';
import { X, Calendar, User, FileText, Settings, Link as LinkIcon, Plus } from 'lucide-react';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Partial<Task>) => void;
  task?: Task | null; // If present, we are editing
  employees: Employee[];
  allTasks: Task[];
  documents: LinkedDoc[];
  onAddDocument: (doc: LinkedDoc) => void;
}

export default function TaskModal({
  isOpen,
  onClose,
  onSave,
  task,
  employees,
  allTasks,
  documents,
  onAddDocument
}: TaskModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [project, setProject] = useState('');
  const [priority, setPriority] = useState<Priority>('Medium');
  const [status, setStatus] = useState<TaskStatus>('Not Started');
  const [progress, setProgress] = useState(0);
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [actualEndDate, setActualEndDate] = useState('');
  const [department, setDepartment] = useState<'IT' | 'HR' | 'Marketing' | 'Sales' | 'Design' | 'Finance'>('IT');
  const [primaryOwnerId, setPrimaryOwnerId] = useState('');
  const [secondaryAssignees, setSecondaryAssignees] = useState<string[]>([]);
  const [contributors, setContributors] = useState<string[]>([]);
  const [dependencies, setDependencies] = useState<string[]>([]);
  const [recurringPattern, setRecurringPattern] = useState<'None' | 'Weekly' | 'Monthly'>('None');
  const [linkedDocs, setLinkedDocs] = useState<string[]>([]);

  // Add new document quick form
  const [showAddDocForm, setShowAddDocForm] = useState(false);
  const [newDocName, setNewDocName] = useState('');
  const [newDocUrl, setNewDocUrl] = useState('');

  useEffect(() => {
    if (task) {
      setTitle(task.title || '');
      setDescription(task.description || '');
      setProject(task.project || '');
      setPriority(task.priority || 'Medium');
      setStatus(task.status || 'Not Started');
      setProgress(task.progress || 0);
      setStartDate(task.startDate || '');
      setDueDate(task.dueDate || '');
      setActualEndDate(task.actualEndDate || '');
      setDepartment(task.department || 'IT');
      setPrimaryOwnerId(task.primaryOwnerId || '');
      setSecondaryAssignees(task.secondaryAssigneeIds || []);
      setContributors(task.contributorIds || []);
      setDependencies(task.dependencies || []);
      setRecurringPattern(task.recurringPattern || 'None');
      setLinkedDocs(task.linkedDocIds || []);
    } else {
      // Defaults
      setTitle('');
      setDescription('');
      setProject('');
      setPriority('Medium');
      setStatus('Not Started');
      setProgress(0);
      setStartDate(new Date().toISOString().split('T')[0]);
      setDueDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
      setActualEndDate('');
      setDepartment('IT');
      setPrimaryOwnerId(employees[0]?.id || '');
      setSecondaryAssignees([]);
      setContributors([]);
      setDependencies([]);
      setRecurringPattern('None');
      setLinkedDocs([]);
    }
  }, [task, isOpen, employees]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !project.trim()) {
      alert('กรุณากรอกหัวข้องานและชื่อโครงการ');
      return;
    }

    const taskData: Partial<Task> = {
      title,
      description,
      project,
      priority,
      status,
      progress: status === 'Completed' ? 100 : progress,
      startDate,
      dueDate,
      actualEndDate: status === 'Completed' ? (actualEndDate || new Date().toISOString().split('T')[0]) : (actualEndDate || undefined),
      department,
      primaryOwnerId,
      secondaryAssigneeIds: secondaryAssignees,
      contributorIds: contributors,
      dependencies,
      recurringPattern,
      linkedDocIds: linkedDocs,
      approvalStatus: status === 'Completed' && task?.approvalStatus !== 'Approved' ? 'Pending Approval' : (task?.approvalStatus || 'None')
    };

    onSave(taskData);
    onClose();
  };

  const toggleSecondaryAssignee = (id: string) => {
    if (secondaryAssignees.includes(id)) {
      setSecondaryAssignees(secondaryAssignees.filter(item => item !== id));
    } else {
      setSecondaryAssignees([...secondaryAssignees, id]);
    }
  };

  const toggleContributor = (id: string) => {
    if (contributors.includes(id)) {
      setContributors(contributors.filter(item => item !== id));
    } else {
      setContributors([...contributors, id]);
    }
  };

  const toggleDependency = (id: string) => {
    if (dependencies.includes(id)) {
      setDependencies(dependencies.filter(item => item !== id));
    } else {
      setDependencies([...dependencies, id]);
    }
  };

  const toggleLinkedDoc = (id: string) => {
    if (linkedDocs.includes(id)) {
      setLinkedDocs(linkedDocs.filter(item => item !== id));
    } else {
      setLinkedDocs([...linkedDocs, id]);
    }
  };

  const handleQuickAddDoc = () => {
    if (!newDocName.trim() || !newDocUrl.trim()) return;
    const newDoc: LinkedDoc = {
      id: 'DOC_QUICK_' + Date.now(),
      name: newDocName,
      kind: 'link',
      parentId: null,
      url: newDocUrl,
      scope: 'ส่วนตัว',
      version: 1,
      lastUpdated: new Date().toISOString().replace('T', ' ').substring(0, 16),
      updatedBy: 'ผู้ใช้งานปัจจุบัน',
      history: [{ version: 1, updatedBy: 'ผู้ใช้งานปัจจุบัน', date: new Date().toISOString().replace('T', ' ').substring(0, 16), note: 'สร้างจากแบบฟอร์มเพิ่มงานด่วน' }]
    };
    onAddDocument(newDoc);
    setLinkedDocs([...linkedDocs, newDoc.id]);
    setNewDocName('');
    setNewDocUrl('');
    setShowAddDocForm(false);
  };

  // Filter out the current task itself from potential dependencies to prevent circular ref
  const potentialDependencies = allTasks.filter(t => !task || t.id !== task.id);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4" id="task-modal-container">
      <div className="bg-white rounded-2xl w-full max-w-4xl shadow-xl border border-slate-100 flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-bold text-slate-900" id="modal-title">
              {task ? '📝 แก้ไขข้อมูลงาน / โครงการ' : '✨ สร้างงานและโครงการใหม่'}
            </h3>
            <p className="text-xs text-slate-500 mt-1">กำหนดรายชื่อ รายละเอียด ผู้รับผิดชอบ และเอกสารที่แนบของงาน</p>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-6 flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Left Side: Basic Info */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ชื่อโครงการ *</label>
                <input 
                  type="text"
                  required
                  placeholder="เช่น ระบบจัดการแผนงาน UnitySpace"
                  value={project}
                  onChange={(e) => setProject(e.target.value)}
                  className="w-full text-sm px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  id="task-project-input"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">หัวข้องาน *</label>
                <input 
                  type="text"
                  required
                  placeholder="เช่น ออกแบบหน้าจอแดชบอร์ด"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full text-sm px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  id="task-title-input"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">รายละเอียดงาน</label>
                <textarea 
                  rows={4}
                  placeholder="อธิบายรายละเอียดการทำงาน ขั้นตอนการดำเนินงาน หรือผลลัพธ์ที่ต้องการ..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full text-sm px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">ระดับความสำคัญ</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as Priority)}
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="Low">Low (ต่ำ)</option>
                    <option value="Medium">Medium (ปานกลาง)</option>
                    <option value="High">High (สูง)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">แผนกที่เกี่ยวข้อง</label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value as any)}
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="IT">IT Department</option>
                    <option value="HR">HR Department</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Sales">Sales Department</option>
                    <option value="Design">Design Department</option>
                    <option value="Finance">Finance Department</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">สถานะงาน</label>
                  <select
                    value={status}
                    onChange={(e) => {
                      const newStatus = e.target.value as TaskStatus;
                      setStatus(newStatus);
                      if (newStatus === 'Completed') {
                        setProgress(100);
                        if (!actualEndDate) {
                          setActualEndDate(new Date().toISOString().split('T')[0]);
                        }
                      } else if (newStatus === 'Not Started') {
                        setProgress(0);
                      }
                    }}
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="Not Started">ยังไม่เริ่ม (Not Started)</option>
                    <option value="In Progress">กำลังดำเนินการ (In Progress)</option>
                    <option value="Completed">เสร็จสิ้น (Completed)</option>
                    <option value="On Hold">ระงับชั่วคราว (On Hold)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">ความคืบหน้า ({progress}%)</label>
                  <div className="flex items-center gap-2 pt-1.5">
                    <input 
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={progress}
                      disabled={status === 'Completed'}
                      onChange={(e) => setProgress(parseInt(e.target.value))}
                      className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600 disabled:opacity-50"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">วันที่เริ่มต้นงาน</label>
                  <input 
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">กำหนดส่งงาน (Due Date)</label>
                  <input 
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {status === 'Completed' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">วันเสร็จสิ้นจริง (Actual End Date)</label>
                  <input 
                    type="date"
                    value={actualEndDate}
                    onChange={(e) => setActualEndDate(e.target.value)}
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-emerald-50/50 border-emerald-200 text-emerald-800"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ความถี่ของงานซ้ำ (Recurring Pattern)</label>
                <select
                  value={recurringPattern}
                  onChange={(e) => setRecurringPattern(e.target.value as any)}
                  className="w-full text-sm px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="None">งานเดี่ยว (ไม่มีการทำซ้ำ)</option>
                  <option value="Weekly">ทำซ้ำทุกสัปดาห์ (Weekly)</option>
                  <option value="Monthly">ทำซ้ำทุกเดือน (Monthly)</option>
                </select>
              </div>

            </div>

            {/* Right Side: Accountabilities & Docs & Dependencies */}
            <div className="space-y-5">
              
              {/* Primary Owner */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ผู้รับผิดชอบหลัก (บุคคลหลัก) *</label>
                <select
                  value={primaryOwnerId}
                  required
                  onChange={(e) => setPrimaryOwnerId(e.target.value)}
                  className="w-full text-sm px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="">-- เลือกผู้รับผิดชอบหลัก --</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name} ({emp.role} - {emp.department})</option>
                  ))}
                </select>
              </div>

              {/* Secondary Assignees */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ผู้รับมอบหมายรอง / ทีมร่วมงาน</label>
                <div className="border border-slate-200 rounded-xl p-3 max-h-[120px] overflow-y-auto space-y-1.5 bg-slate-50/30">
                  {employees.filter(e => e.id !== primaryOwnerId).map(emp => (
                    <label key={emp.id} className="flex items-center gap-2 text-xs text-slate-700 hover:text-slate-900 cursor-pointer">
                      <input 
                        type="checkbox"
                        checked={secondaryAssignees.includes(emp.id)}
                        onChange={() => toggleSecondaryAssignee(emp.id)}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>{emp.name} ({emp.role})</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Contributors */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ผู้ร่วมให้ข้อมูล / ผู้มีส่วนร่วมสนับสนุน</label>
                <div className="border border-slate-200 rounded-xl p-3 max-h-[120px] overflow-y-auto space-y-1.5 bg-slate-50/30">
                  {employees.filter(e => e.id !== primaryOwnerId && !secondaryAssignees.includes(e.id)).map(emp => (
                    <label key={emp.id} className="flex items-center gap-2 text-xs text-slate-700 hover:text-slate-900 cursor-pointer">
                      <input 
                        type="checkbox"
                        checked={contributors.includes(emp.id)}
                        onChange={() => toggleContributor(emp.id)}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>{emp.name} ({emp.department})</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Task Dependencies */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">งานที่ต้องทำเสร็จก่อน (Dependencies)</label>
                {potentialDependencies.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic">ไม่มีงานอื่นในระบบที่นำมาผูกความสัมพันธ์ได้</p>
                ) : (
                  <div className="border border-slate-200 rounded-xl p-3 max-h-[120px] overflow-y-auto space-y-1.5 bg-slate-50/30">
                    {potentialDependencies.map(t => (
                      <label key={t.id} className="flex items-center gap-2 text-xs text-slate-700 hover:text-slate-900 cursor-pointer">
                        <input 
                          type="checkbox"
                          checked={dependencies.includes(t.id)}
                          onChange={() => toggleDependency(t.id)}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="font-medium text-slate-800">[{t.project}]</span>
                        <span className="truncate">{t.title}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Documents Linking */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">แนบลิงก์เอกสาร Google Drive / สื่ออื่นๆ</label>
                  <button
                    type="button"
                    onClick={() => setShowAddDocForm(!showAddDocForm)}
                    className="text-[11px] text-indigo-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={12} /> แนบลิงก์ใหม่ด่วน
                  </button>
                </div>

                {/* Show/Hide Add Quick Doc */}
                {showAddDocForm && (
                  <div className="p-3 border border-indigo-100 bg-indigo-50/20 rounded-xl mb-2 space-y-2.5 text-xs animate-in slide-in-from-top-2 duration-150">
                    <input
                      type="text"
                      placeholder="ชื่อเอกสาร เช่น แผน Q3"
                      value={newDocName}
                      onChange={(e) => setNewDocName(e.target.value)}
                      className="w-full p-1.5 border border-slate-200 rounded bg-white text-xs"
                    />
                    <div className="flex gap-2">
                      <input 
                        type="url" 
                        placeholder="ลิงก์ URL (https://docs.google.com/...)" 
                        value={newDocUrl}
                        onChange={(e) => setNewDocUrl(e.target.value)}
                        className="flex-1 p-1.5 border border-slate-200 rounded bg-white text-xs"
                      />
                      <button
                        type="button"
                        onClick={handleQuickAddDoc}
                        className="bg-indigo-600 text-white px-3 rounded font-medium text-xs hover:bg-indigo-500 cursor-pointer"
                      >
                        เพิ่ม
                      </button>
                    </div>
                  </div>
                )}

                <div className="border border-slate-200 rounded-xl p-3 max-h-[130px] overflow-y-auto space-y-1.5 bg-slate-50/30">
                  {documents.filter(doc => doc.kind !== 'folder').length === 0 ? (
                    <p className="text-[11px] text-slate-400 italic">ไม่มีเอกสารในระบบขณะนี้</p>
                  ) : (
                    documents.filter(doc => doc.kind !== 'folder').map(doc => (
                      <label key={doc.id} className="flex items-center gap-2 text-xs text-slate-700 hover:text-slate-900 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={linkedDocs.includes(doc.id)}
                          onChange={() => toggleLinkedDoc(doc.id)}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="font-semibold text-slate-500 uppercase text-[10px]">[{doc.kind === 'file' ? 'ไฟล์' : 'ลิงก์'}]</span>
                        <span className="truncate">{doc.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

            </div>

          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 rounded-xl border border-slate-200 cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-md cursor-pointer"
              id="btn-save-task"
            >
              💾 บันทึกข้อมูล
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
