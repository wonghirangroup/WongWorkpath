import React, { useState, useMemo } from 'react';
import { Task, Employee, LeaveRequest, Department } from '../types';
import { 
  Calendar as CalIcon, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  User, 
  Coffee, 
  AlertCircle,
  Clock,
  RefreshCw
} from 'lucide-react';

interface CalendarViewProps {
  tasks: Task[];
  employees: Employee[];
  leaveRequests: LeaveRequest[];
  onAddLeaveRequest: (leave: Omit<LeaveRequest, 'id'>) => void;
}

export default function CalendarView({
  tasks,
  employees,
  leaveRequests,
  onAddLeaveRequest
}: CalendarViewProps) {
  const [currentYear, setCurrentYear] = useState(2026);
  const [currentMonth, setCurrentMonth] = useState(6); // 6 = July (0-indexed, so 5 is June, 6 is July)

  const [filterType, setFilterType] = useState<'All' | 'Tasks' | 'TeamLeaves'>('All');
  const [selectedDept, setSelectedDept] = useState<string>('All');

  // Leave Form State
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveEmployeeId, setLeaveEmployeeId] = useState(employees[0]?.id || '');
  const [leaveType, setLeaveType] = useState<'Vacation' | 'Sick Leave' | 'Personal Leave' | 'Business Leave'>('Vacation');
  const [leaveStart, setLeaveStart] = useState('2026-07-06');
  const [leaveEnd, setLeaveEnd] = useState('2026-07-08');
  const [leaveNotes, setLeaveNotes] = useState('');

  const monthsThai = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];

  const daysOfWeek = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

  // Calculate days in the current month
  const calendarGrid = useMemo(() => {
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
    const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const totalDaysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

    const cells: { date: Date; isCurrentMonth: boolean; key: string }[] = [];

    // Prev month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = totalDaysInPrevMonth - i;
      const date = new Date(currentYear, currentMonth - 1, d);
      cells.push({
        date,
        isCurrentMonth: false,
        key: `prev-${d}`
      });
    }

    // Current month days
    for (let d = 1; d <= totalDaysInMonth; d++) {
      const date = new Date(currentYear, currentMonth, d);
      cells.push({
        date,
        isCurrentMonth: true,
        key: `curr-${d}`
      });
    }

    // Next month padding to fill grid (usually 42 cells for 6 rows)
    const totalCells = cells.length;
    const remainingCells = 42 - totalCells;
    for (let d = 1; d <= remainingCells; d++) {
      const date = new Date(currentYear, currentMonth + 1, d);
      cells.push({
        date,
        isCurrentMonth: false,
        key: `next-${d}`
      });
    }

    return cells;
  }, [currentYear, currentMonth]);

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  // Check if a date has tasks falling on it
  const getTasksOnDate = (date: Date) => {
    const dateString = date.toISOString().split('T')[0];
    return tasks.filter(task => {
      // Filter by department if selected
      if (selectedDept !== 'All' && task.department !== selectedDept) return false;

      // Regular check
      if (task.startDate <= dateString && task.dueDate >= dateString) {
        return true;
      }

      // Check recurring weekly (if date matches start day of week)
      if (task.recurringPattern === 'Weekly') {
        const startDay = new Date(task.startDate).getDay();
        if (date.getDay() === startDay && dateString >= task.startDate) {
          return true;
        }
      }

      // Check recurring monthly (if date matches start date day)
      if (task.recurringPattern === 'Monthly') {
        const startDayNum = new Date(task.startDate).getDate();
        if (date.getDate() === startDayNum && dateString >= task.startDate) {
          return true;
        }
      }

      return false;
    });
  };

  // Check if a date has leaves falling on it
  const getLeavesOnDate = (date: Date) => {
    const dateString = date.toISOString().split('T')[0];
    return leaveRequests.filter(leave => {
      if (leave.status !== 'Approved') return false; // only show approved leaves on calendar
      return leave.startDate <= dateString && leave.endDate >= dateString;
    });
  };

  const getTaskStatusColor = (status: string) => {
    switch (status) {
      case 'Completed': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'In Progress': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'On Hold': return 'bg-rose-100 text-rose-800 border-rose-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const handleLeaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveNotes.trim()) {
      alert('กรุณากรอกเหตุผลการลา');
      return;
    }

    const employee = employees.find(e => e.id === leaveEmployeeId);
    
    onAddLeaveRequest({
      employeeId: leaveEmployeeId,
      employeeName: employee?.name || 'ไม่ระบุชื่อ',
      type: leaveType,
      startDate: leaveStart,
      endDate: leaveEnd,
      status: 'Pending',
      notes: leaveNotes
    });

    setLeaveNotes('');
    setShowLeaveForm(false);
    alert('ส่งคำขออนุมัติลางานเรียบร้อยแล้ว รอผู้จัดการตรวจสอบในแดชบอร์ด');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6" id="calendar-tab">
      
      {/* Sidebar: Calendar Filters and File Leave Form */}
      <div className="lg:col-span-1 space-y-6">
        
        {/* Calendar View Filters */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <CalIcon size={16} className="text-indigo-600" /> ตัวกรองปฏิทิน
          </h3>

          <div className="space-y-2">
            <button
              onClick={() => setFilterType('All')}
              className={`w-full text-left text-xs px-3 py-2 rounded-xl border font-medium transition-colors ${
                filterType === 'All' 
                  ? 'bg-indigo-600 border-indigo-600 text-white' 
                  : 'bg-white border-slate-100 text-slate-700 hover:bg-slate-50'
              }`}
            >
              🗓️ แสดงทุกอย่าง
            </button>
            <button
              onClick={() => setFilterType('Tasks')}
              className={`w-full text-left text-xs px-3 py-2 rounded-xl border font-medium transition-colors ${
                filterType === 'Tasks' 
                  ? 'bg-indigo-600 border-indigo-600 text-white' 
                  : 'bg-white border-slate-100 text-slate-700 hover:bg-slate-50'
              }`}
            >
              📝 เฉพาะกำหนดการส่งงาน
            </button>
            <button
              onClick={() => setFilterType('TeamLeaves')}
              className={`w-full text-left text-xs px-3 py-2 rounded-xl border font-medium transition-colors ${
                filterType === 'TeamLeaves' 
                  ? 'bg-indigo-600 border-indigo-600 text-white' 
                  : 'bg-white border-slate-100 text-slate-700 hover:bg-slate-50'
              }`}
            >
              🏖️ ปฏิทินทีมและวันหยุด
            </button>
          </div>

          <div className="pt-3 border-t border-slate-100">
            <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">แยกตามแผนก</label>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full text-xs px-2.5 py-2 border border-slate-200 rounded-lg bg-white"
            >
              <option value="All">ทุกแผนก</option>
              <option value="IT">IT Department</option>
              <option value="Design">Design Department</option>
              <option value="Marketing">Marketing</option>
              <option value="Finance">Finance Department</option>
            </select>
          </div>
        </div>

        {/* Leave Request Panel */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Coffee size={16} className="text-emerald-600" /> ลาพักร้อน / ใบลา
            </h3>
            <button
              onClick={() => setShowLeaveForm(!showLeaveForm)}
              className="text-[11px] bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold px-2 py-1 rounded-lg cursor-pointer"
            >
              {showLeaveForm ? 'ปิดแบบฟอร์ม' : 'เขียนใบลา'}
            </button>
          </div>

          {showLeaveForm ? (
            <form onSubmit={handleLeaveSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">เลือกผู้ลางาน</label>
                <select
                  value={leaveEmployeeId}
                  onChange={(e) => setLeaveEmployeeId(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg bg-white"
                >
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">ประเภทการลา</label>
                <select
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value as any)}
                  className="w-full p-2 border border-slate-200 rounded-lg bg-white"
                >
                  <option value="Vacation">ลาพักร้อน (Vacation)</option>
                  <option value="Sick Leave">ลาป่วย (Sick Leave)</option>
                  <option value="Personal Leave">ลากิจส่วนตัว (Personal Leave)</option>
                  <option value="Business Leave">ลางานธุรกิจ (Business Leave)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">วันเริ่มต้น</label>
                  <input 
                    type="date" 
                    value={leaveStart}
                    onChange={(e) => setLeaveStart(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">วันสิ้นสุด</label>
                  <input 
                    type="date" 
                    value={leaveEnd}
                    onChange={(e) => setLeaveEnd(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">เหตุผลประกอบการลา</label>
                <input 
                  type="text" 
                  placeholder="เช่น ไปต่างจังหวัด, มีนัดพบแพทย์"
                  value={leaveNotes}
                  onChange={(e) => setLeaveNotes(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg text-xs"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2 rounded-xl cursor-pointer"
              >
                ส่งคำขอใบลา
              </button>
            </form>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-slate-500 leading-relaxed">
                พนักงานสามารถยื่นใบลาพักล่วงหน้าได้จากตรงนี้ ระบบจะเชื่อมข้อมูลกับปฏิทินทีมหลักเพื่อให้หัวหน้างานสามารถจัดตารางงานที่เหมาะสม
              </p>

              {/* Leave List Approved */}
              <div className="space-y-2 pt-2 border-t border-slate-100 max-h-[180px] overflow-y-auto">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">รายชื่อการลาพักร้อนที่อนุมัติแล้ว</span>
                {leaveRequests.filter(r => r.status === 'Approved').length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic">ไม่มีพนักงานลาพักในช่วงเวลานี้</p>
                ) : (
                  leaveRequests.filter(r => r.status === 'Approved').map(leave => (
                    <div key={leave.id} className="text-[11px] p-2 bg-emerald-50/50 border border-emerald-100 rounded-lg flex justify-between items-center">
                      <div>
                        <p className="font-semibold text-slate-800">{leave.employeeName}</p>
                        <p className="text-slate-500 text-[10px]">{leave.startDate} ถึง {leave.endDate}</p>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-800">{leave.type}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Main Calendar View Area */}
      <div className="lg:col-span-3 bg-white p-6 rounded-2xl border border-slate-100 shadow-xs space-y-4">
        
        {/* Calendar Nav Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <CalIcon size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {monthsThai[currentMonth]} {currentYear + 543}
              </h2>
              <p className="text-xs text-slate-500">
                ปีคริสต์ศักราช {currentYear} | มุมมองปฏิทินแบบบูรณาการ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => {
                setCurrentMonth(new Date().getMonth());
                setCurrentYear(new Date().getFullYear());
              }}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-600 cursor-pointer"
            >
              วันนี้
            </button>
            <button
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Days of Week Header Grid */}
        <div className="grid grid-cols-7 gap-1 text-center font-bold text-xs text-slate-400 uppercase select-none border-b border-slate-100 pb-2">
          {daysOfWeek.map((day, idx) => (
            <div 
              key={day} 
              className={idx === 0 ? 'text-rose-500' : idx === 6 ? 'text-slate-500' : 'text-slate-500'}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Month Cell Grid */}
        <div className="grid grid-cols-7 gap-1.5 min-h-[500px]">
          {calendarGrid.map((cell, index) => {
            const hasTasks = filterType !== 'TeamLeaves' ? getTasksOnDate(cell.date) : [];
            const hasLeaves = filterType !== 'Tasks' ? getLeavesOnDate(cell.date) : [];
            const isToday = cell.date.toDateString() === new Date().toDateString();

            return (
              <div 
                key={cell.key}
                className={`p-1.5 border border-slate-100 rounded-xl flex flex-col justify-between hover:bg-slate-50/70 transition-all min-h-[85px] ${
                  cell.isCurrentMonth ? 'bg-white' : 'bg-slate-50/40 text-slate-300'
                } ${isToday ? 'ring-2 ring-indigo-600 ring-offset-1 bg-indigo-50/10' : ''}`}
              >
                {/* Date Number Indicator */}
                <div className="flex justify-between items-center">
                  <span className={`text-xs font-bold ${
                    isToday 
                      ? 'bg-indigo-600 text-white w-5 h-5 flex items-center justify-center rounded-full shadow-xs' 
                      : cell.isCurrentMonth ? 'text-slate-800' : 'text-slate-400'
                  }`}>
                    {cell.date.getDate()}
                  </span>

                  {/* Little helper badge count */}
                  {(hasTasks.length > 0 || hasLeaves.length > 0) && cell.isCurrentMonth && (
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>
                  )}
                </div>

                {/* Grid Events container */}
                <div className="mt-1.5 space-y-1 overflow-y-auto max-h-[60px] pr-0.5">
                  
                  {/* Tasks deadlining/starting */}
                  {hasTasks.slice(0, 2).map(task => (
                    <div 
                      key={task.id}
                      className={`text-[9px] px-1.5 py-0.5 rounded-md border truncate font-medium ${getTaskStatusColor(task.status)}`}
                      title={`[${task.project}] ${task.title}`}
                    >
                      {task.recurringPattern !== 'None' && (
                        <span className="inline-block mr-0.5 text-indigo-600 font-bold">🔁</span>
                      )}
                      {task.title}
                    </div>
                  ))}

                  {/* Leaves approved */}
                  {hasLeaves.slice(0, 1).map(leave => (
                    <div 
                      key={leave.id}
                      className="text-[9px] px-1.5 py-0.5 rounded-md border bg-amber-50 text-amber-800 border-amber-200 truncate font-semibold flex items-center gap-0.5"
                      title={`${leave.employeeName} ลาพักร้อน`}
                    >
                      <span>🏖️</span>
                      <span className="truncate">{leave.employeeName} ลา</span>
                    </div>
                  ))}

                  {/* Excess Tasks hidden indicator */}
                  {hasTasks.length > 2 && (
                    <div className="text-[8px] text-center text-slate-400 font-bold bg-slate-50 py-0.2 rounded">
                      + อีก {hasTasks.length - 2} งาน
                    </div>
                  )}

                </div>

              </div>
            );
          })}
        </div>

        {/* Legend Information */}
        <div className="pt-4 border-t border-slate-100 flex flex-wrap gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-blue-100 border border-blue-200 block"></span>
            <span>งานกําลังดําเนินการ</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-emerald-100 border border-emerald-200 block"></span>
            <span>งานเสร็จสิ้นแล้ว</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-amber-50 border border-amber-200 block"></span>
            <span>พนักงานลางานพรีเมียม</span>
          </div>
          <div className="flex items-center gap-1">
            <span>🔁</span>
            <span>ตารางงานแบบเกิดซ้ำ (Weekly/Monthly)</span>
          </div>
        </div>

      </div>

    </div>
  );
}
