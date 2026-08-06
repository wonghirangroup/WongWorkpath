import React, { useState, useMemo } from 'react';
import { Task, Employee, LinkedDoc, Priority, TaskStatus } from '../types';
import { 
  Search, 
  Filter, 
  Trash2, 
  Edit3, 
  Plus, 
  FileText, 
  Link2, 
  ArrowRight, 
  TrendingUp, 
  User, 
  CheckCircle,
  FileDown,
  FileSpreadsheet,
  Layers,
  AlertCircle
} from 'lucide-react';

interface TaskListViewProps {
  tasks: Task[];
  employees: Employee[];
  documents: LinkedDoc[];
  onAddTask: () => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (id: string) => void;
  onInitiateHandover: (taskId: string, fromUserId: string, toUserId: string, stageName: string, notes: string) => void;
  onOpenDoc: (docId: string) => void;
}

export default function TaskListView({
  tasks,
  employees,
  documents,
  onAddTask,
  onEditTask,
  onDeleteTask,
  onInitiateHandover,
  onOpenDoc
}: TaskListViewProps) {
  // Search & Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [selectedPriority, setSelectedPriority] = useState<string>('All');
  const [selectedDept, setSelectedDept] = useState<string>('All');
  const [selectedOwner, setSelectedOwner] = useState<string>('All');

  // Handover form state per task
  const [activeHandoverTaskId, setActiveHandoverTaskId] = useState<string | null>(null);
  const [handoverToUserId, setHandoverToUserId] = useState('');
  const [handoverStageName, setHandoverStageName] = useState('');
  const [handoverNotes, setHandoverNotes] = useState('');

  // Filtering Logic
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const matchSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          task.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          task.project.toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = selectedStatus === 'All' || task.status === selectedStatus;
      const matchPriority = selectedPriority === 'All' || task.priority === selectedPriority;
      const matchDept = selectedDept === 'All' || task.department === selectedDept;
      const matchOwner = selectedOwner === 'All' || task.primaryOwnerId === selectedOwner;
      
      return matchSearch && matchStatus && matchPriority && matchDept && matchOwner;
    });
  }, [tasks, searchTerm, selectedStatus, selectedPriority, selectedDept, selectedOwner]);

  const handleExportCSV = () => {
    try {
      let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; // Include BOM for Excel Thai language support
      csvContent += "ID,หัวข้องาน,โครงการ,แผนก,ความสำคัญ,สถานะ,ความคืบหน้า,ผู้รับผิดชอบหลัก,วันที่เริ่มต้น,กำหนดส่ง\n";
      
      filteredTasks.forEach(t => {
        const owner = employees.find(e => e.id === t.primaryOwnerId)?.name || 'ไม่ระบุ';
        const row = [
          t.id,
          `"${t.title.replace(/"/g, '""')}"`,
          `"${t.project.replace(/"/g, '""')}"`,
          t.department,
          t.priority,
          t.status,
          `${t.progress}%`,
          `"${owner}"`,
          t.startDate,
          t.dueDate
        ].join(",");
        csvContent += row + "\n";
      });

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `UnitySpace_Tasks_Export_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      alert('เกิดข้อผิดพลาดในการส่งออกข้อมูล');
    }
  };

  const handleExportReport = (format: 'Excel' | 'PDF') => {
    alert(`กำลังสังเคราะห์และจัดทำรายงานรูปแบบไฟล์ ${format}...\nกรองข้อมูลทั้งหมด ${filteredTasks.length} งาน\nเอกสารจะถูกจำลองการสร้างและเปิดป๊อปอัพให้พิมพ์ข้อมูลสำเร็จ`);
    
    // Simulate beautiful HTML Print Report inside a temporary window frame
    const reportHtml = `
      <html>
        <head>
          <title>รายงานแผนงาน UnitySpace - ${format}</title>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
          <link href="https://fonts.googleapis.com/css2?family=Kanit:wght@400;500;600;700&display=swap" rel="stylesheet" />
          <style>
            body { font-family: 'Kanit', sans-serif; padding: 20px; color: #1e293b; }
            h1 { color: #1e1b4b; text-align: center; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #e2e8f0; padding: 10px; text-align: left; font-size: 12px; }
            th { background-color: #f1f5f9; }
            .badge { padding: 3px 8px; border-radius: 4px; font-weight: bold; font-size: 10px; }
            .bg-high { background-color: #fee2e2; color: #991b1b; }
            .bg-med { background-color: #fef3c7; color: #92400e; }
            .bg-low { background-color: #f1f5f9; color: #334155; }
          </style>
        </head>
        <body onload="window.print()">
          <h1>รายงานความคืบหน้าระบบงาน UnitySpace (${format})</h1>
          <p>พิมพ์เมื่อ: ${new Date().toLocaleString('th-TH')}</p>
          <p>รวมรายงานทั้งสิ้น: ${filteredTasks.length} รายการงานตามเกณฑ์คัดกรอง</p>
          <table>
            <thead>
              <tr>
                <th>โครงการ</th>
                <th>ชื่องาน</th>
                <th>แผนก</th>
                <th>ความสำคัญ</th>
                <th>สถานะ</th>
                <th>ความก้าวหน้า</th>
                <th>วันที่เริ่มต้น - กำหนดส่ง</th>
              </tr>
            </thead>
            <tbody>
              ${filteredTasks.map(t => `
                <tr>
                  <td><b>${t.project}</b></td>
                  <td>${t.title}</td>
                  <td>${t.department}</td>
                  <td><span class="badge ${t.priority === 'High' ? 'bg-high' : t.priority === 'Medium' ? 'bg-med' : 'bg-low'}">${t.priority}</span></td>
                  <td>${t.status}</td>
                  <td>${t.progress}%</td>
                  <td>${t.startDate} ถึง ${t.dueDate}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;
    
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(reportHtml);
      win.document.close();
    } else {
      alert("กรุณาอนุญาตป๊อปอัพของบราวเซอร์เพื่อดาวน์โหลดและพิมพ์รายงาน");
    }
  };

  const handleHandoverSubmit = (taskId: string) => {
    if (!handoverToUserId || !handoverStageName.trim() || !handoverNotes.trim()) {
      alert('กรุณากรอกข้อมูลการส่งต่อสเตจงานให้ครบถ้วน');
      return;
    }
    const currentTask = tasks.find(t => t.id === taskId);
    if (!currentTask) return;

    onInitiateHandover(taskId, currentTask.primaryOwnerId, handoverToUserId, handoverStageName, handoverNotes);
    
    // Reset state
    setActiveHandoverTaskId(null);
    setHandoverToUserId('');
    setHandoverStageName('');
    setHandoverNotes('');
    alert('ส่งมอบสเตจงานเรียบร้อยแล้ว! ข้อมูลจะถูกบันทึกในตารางเพื่อรอการอนุมัติในหน้าแรก');
  };

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'Completed': return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'In Progress': return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'On Hold': return 'bg-rose-50 text-rose-800 border-rose-200';
      default: return 'bg-slate-50 text-slate-800 border-slate-200';
    }
  };

  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case 'High': return 'bg-rose-50 text-rose-700 border-rose-100';
      case 'Medium': return 'bg-amber-50 text-amber-700 border-amber-100';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6" id="task-list-tab">
      
      {/* Top filter dashboard */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-2xs space-y-4">
        
        {/* Search Input and Export Actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text"
              placeholder="ค้นหาชื่องาน โครงการ คำอธิบายรายละเอียด..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              id="task-search-input"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 text-xs bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold px-3 py-2 rounded-xl transition-colors cursor-pointer"
              title="ส่งออกงานทั้งหมดเป็น CSV"
            >
              <FileSpreadsheet size={14} className="text-emerald-600" />
              ส่งออก CSV
            </button>
            <button
              onClick={() => handleExportReport('Excel')}
              className="flex items-center gap-1.5 text-xs bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold px-3 py-2 rounded-xl transition-colors cursor-pointer"
              title="สร้างตารางวิเคราะห์ Excel"
            >
              <FileDown size={14} className="text-indigo-600" />
              สรุปงบ Excel
            </button>
            <button
              onClick={() => handleExportReport('PDF')}
              className="flex items-center gap-1.5 text-xs bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold px-3 py-2 rounded-xl transition-colors cursor-pointer"
              title="จัดพิมพ์รายงานสถิติ PDF"
            >
              <FileText size={14} className="text-rose-600" />
              พิมพ์รายงาน PDF
            </button>

            <button
              onClick={onAddTask}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-md transition-all cursor-pointer"
              id="btn-create-task-list"
            >
              <Plus size={15} />
              สร้างงานใหม่
            </button>
          </div>
        </div>

        {/* Filters Select Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-slate-100 text-xs">
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">สถานะงาน</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full p-2 border border-slate-200 rounded-lg bg-white"
            >
              <option value="All">ทุกสถานะงาน ({tasks.length})</option>
              <option value="Not Started">ยังไม่เริ่ม (Not Started)</option>
              <option value="In Progress">กำลังดำเนินการ (In Progress)</option>
              <option value="Completed">เสร็จสิ้น (Completed)</option>
              <option value="On Hold">ระงับชั่วคราว (On Hold)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">ระดับความสำคัญ</label>
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="w-full p-2 border border-slate-200 rounded-lg bg-white"
            >
              <option value="All">ทุกระดับความสำคัญ</option>
              <option value="High">ความสำคัญ: สูง (High)</option>
              <option value="Medium">ความสำคัญ: ปานกลาง (Medium)</option>
              <option value="Low">ความสำคัญ: ต่ำ (Low)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">กรองรายแผนก</label>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full p-2 border border-slate-200 rounded-lg bg-white"
            >
              <option value="All">ทุกแผนก</option>
              <option value="IT">IT Department</option>
              <option value="HR">HR Department</option>
              <option value="Marketing">Marketing</option>
              <option value="Sales">Sales Department</option>
              <option value="Design">Design Department</option>
              <option value="Finance">Finance Department</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">ผู้ดูแลรับผิดชอบหลัก</label>
            <select
              value={selectedOwner}
              onChange={(e) => setSelectedOwner(e.target.value)}
              className="w-full p-2 border border-slate-200 rounded-lg bg-white"
            >
              <option value="All">พนักงานทุกคน</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
          </div>
        </div>

      </div>

      {/* Tasks Render Box List */}
      <div className="space-y-4" id="tasks-list-container">
        {filteredTasks.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs">
            ไม่พบงานที่ตรงตามเงื่อนไข ค้นหาหรือสร้างหัวข้องานใหม่
          </div>
        ) : (
          filteredTasks.map(task => {
            const primaryOwner = employees.find(e => e.id === task.primaryOwnerId);
            const isHandoverOpen = activeHandoverTaskId === task.id;

            return (
              <div 
                key={task.id} 
                className="bg-white p-5 rounded-2xl border border-slate-100 shadow-3xs flex flex-col md:flex-row md:items-center justify-between gap-5 transition-all hover:border-slate-200"
              >
                
                {/* Left Block: Basic Details */}
                <div className="space-y-2.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded-md">
                      {task.project}
                    </span>
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${getStatusBadgeStyle(task.status)}`}>
                      {task.status}
                    </span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${getPriorityStyle(task.priority)}`}>
                      ระดับ {task.priority}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      แผนก {task.department}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                      {task.title}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed max-w-2xl">
                      {task.description || 'ไม่มีรายละเอียดเนื้อหางาน'}
                    </p>
                  </div>

                  {/* Date timelines and Progress Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 text-xs text-slate-400 pt-1.5">
                    <div className="flex items-center gap-1">
                      <span>📅 เริ่ม:</span>
                      <span className="font-semibold text-slate-600">{task.startDate}</span>
                      <span className="mx-1">ถึง</span>
                      <span>กำหนด:</span>
                      <span className="font-semibold text-slate-600">{task.dueDate}</span>
                    </div>

                    {task.actualEndDate && (
                      <div className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-medium text-[11px]">
                        เสร็จสิ้นจริง: {task.actualEndDate}
                      </div>
                    )}

                    {/* Simple progress bar */}
                    <div className="flex items-center gap-2 flex-1 max-w-[200px]">
                      <span className="text-[10px] font-bold text-slate-500 shrink-0">ก้าวหน้า:</span>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${task.status === 'Completed' ? 'bg-emerald-500' : 'bg-indigo-600'}`}
                          style={{ width: `${task.progress}%` }}
                        ></div>
                      </div>
                      <span className="text-[10px] font-bold text-slate-700">{task.progress}%</span>
                    </div>
                  </div>

                  {/* Team Members Accountability */}
                  <div className="flex flex-wrap items-center gap-3 pt-2 text-[11px] text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <img src={primaryOwner?.avatar} alt="" className="w-5 h-5 rounded-full object-cover" />
                      <span>หลัก: <span className="font-semibold text-slate-800">{primaryOwner?.name || 'ไม่ระบุ'}</span></span>
                    </div>

                    {task.secondaryAssigneeIds.length > 0 && (
                      <div className="flex items-center gap-1 text-slate-400 border-l border-slate-200 pl-3">
                        <span>ทีมร่วม ({task.secondaryAssigneeIds.length}):</span>
                        <div className="flex -space-x-1.5">
                          {task.secondaryAssigneeIds.map(id => {
                            const emp = employees.find(e => e.id === id);
                            return (
                              <img key={id} src={emp?.avatar} alt="" className="w-4 h-4 rounded-full border border-white object-cover" title={emp?.name} />
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {task.contributorIds.length > 0 && (
                      <span className="border-l border-slate-200 pl-3">
                        ผู้สนับสนุน: {task.contributorIds.map(id => employees.find(e => e.id === id)?.name).join(', ')}
                      </span>
                    )}

                    {task.recurringPattern !== 'None' && (
                      <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px] font-semibold">
                        🔁 ทำซ้ำ {task.recurringPattern}
                      </span>
                    )}
                  </div>

                  {/* Linked Files list */}
                  {task.linkedDocIds.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      <span className="text-[10px] text-slate-400 self-center">📂 ไฟล์แนบของงาน:</span>
                      {task.linkedDocIds.map(docId => {
                        const doc = documents.find(d => d.id === docId);
                        if (!doc) return null;
                        return (
                          <button
                            key={docId}
                            onClick={() => onOpenDoc(docId)}
                            className="text-[10px] bg-slate-50 hover:bg-indigo-50 border border-slate-100 hover:border-indigo-200 text-slate-600 hover:text-indigo-800 px-2.5 py-0.5 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Link2 size={10} />
                            {doc.name}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Handover stage active trigger */}
                  {isHandoverOpen && (
                    <div className="p-4 border border-indigo-100 bg-indigo-50/20 rounded-xl mt-3 space-y-3 text-xs animate-in slide-in-from-top-2 duration-150">
                      <div className="flex justify-between items-center pb-1 border-b border-indigo-100/50">
                        <h4 className="font-bold text-slate-800 flex items-center gap-1">
                          <ArrowRight size={13} className="text-indigo-600" /> ทำบันทึกการส่งต่องาน (Handover Stage Process)
                        </h4>
                        <button type="button" onClick={() => setActiveHandoverTaskId(null)} className="text-slate-400 hover:text-slate-600 font-bold">ยกเลิก</button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-1">ส่งต่อไปที่พนักงานผู้รับผิดชอบใหม่ *</label>
                          <select
                            value={handoverToUserId}
                            onChange={(e) => setHandoverToUserId(e.target.value)}
                            className="w-full p-2 border border-slate-200 rounded-lg bg-white"
                          >
                            <option value="">-- เลือกผู้รับมอบช่วง --</option>
                            {employees.filter(e => e.id !== task.primaryOwnerId).map(e => (
                              <option key={e.id} value={e.id}>{e.name} ({e.role})</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-1">ชื่อขั้นตอนย่อยการส่งมอบ (Stage Name) *</label>
                          <input 
                            type="text"
                            placeholder="เช่น ร่างโครงสร้าง UI หรือ รันเทสสเปกแบรนด์"
                            value={handoverStageName}
                            onChange={(e) => setHandoverStageName(e.target.value)}
                            className="w-full p-2 border border-slate-200 rounded-lg"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">รายละเอียดและคำอธิบายสเตจการส่งมอบ *</label>
                        <textarea 
                          rows={2}
                          placeholder="อธิบายว่าคุณได้ทำอะไรเสร็จสิ้น และต้องการส่งต่อให้อีกฝ่ายดูแลต่อส่วนงานใด..."
                          value={handoverNotes}
                          onChange={(e) => setHandoverNotes(e.target.value)}
                          className="w-full p-2 border border-slate-200 rounded-lg"
                        />
                      </div>

                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleHandoverSubmit(task.id)}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-2 rounded-lg cursor-pointer"
                        >
                          ยืนยันสร้างบันทึกส่งมอบ (รออนุมัติ)
                        </button>
                      </div>
                    </div>
                  )}

                </div>

                {/* Right Block: Actions */}
                <div className="flex md:flex-col gap-2 shrink-0 self-end md:self-center">
                  
                  {/* Approval Notice status warning if any */}
                  {task.approvalStatus === 'Pending Approval' && (
                    <div className="bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1 mb-1.5 animate-pulse">
                      <AlertCircle size={11} /> รออนุมัติปิดงาน
                    </div>
                  )}

                  <button
                    onClick={() => setActiveHandoverTaskId(isHandoverOpen ? null : task.id)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-indigo-700 bg-indigo-50 hover:bg-indigo-100 text-xs font-bold cursor-pointer"
                    title="เริ่มกระบวนการส่งต่องานให้อีกคน"
                  >
                    <ArrowRight size={13} /> ส่งต่องาน
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onEditTask(task)}
                      className="p-1.5 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 cursor-pointer"
                      title="แก้ไขงานนี้"
                    >
                      <Edit3 size={13} />
                    </button>
                    <button
                      onClick={() => onDeleteTask(task.id)}
                      className="p-1.5 rounded-xl border border-slate-200 hover:border-rose-300 hover:bg-rose-50 text-slate-500 hover:text-rose-600 cursor-pointer"
                      title="ลบงานนี้ถาวร"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
