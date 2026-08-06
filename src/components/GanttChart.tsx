import React, { useState, useMemo } from 'react';
import { Task, Employee, Department } from '../types';
import { Filter, Calendar, Users, Briefcase, ArrowRight, HelpCircle } from 'lucide-react';

interface GanttChartProps {
  tasks: Task[];
  employees: Employee[];
}

export default function GanttChart({ tasks, employees }: GanttChartProps) {
  // Filters State
  const [selectedDept, setSelectedDept] = useState<string>('All');
  const [selectedOwner, setSelectedOwner] = useState<string>('All');
  const [selectedProject, setSelectedProject] = useState<string>('All');

  // Available Filter Options
  const departments = useMemo(() => {
    const list = new Set<string>();
    tasks.forEach(t => list.add(t.department));
    return ['All', ...Array.from(list)];
  }, [tasks]);

  const projects = useMemo(() => {
    const list = new Set<string>();
    tasks.forEach(t => list.add(t.project));
    return ['All', ...Array.from(list)];
  }, [tasks]);

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const matchDept = selectedDept === 'All' || task.department === selectedDept;
      const matchOwner = selectedOwner === 'All' || task.primaryOwnerId === selectedOwner;
      const matchProj = selectedProject === 'All' || task.project === selectedProject;
      return matchDept && matchOwner && matchProj;
    });
  }, [tasks, selectedDept, selectedOwner, selectedProject]);

  // Find the overall date boundary
  const { minDate, maxDate, totalDays, dateList } = useMemo(() => {
    let start = new Date('2026-06-15');
    let end = new Date('2026-07-20');

    // If tasks fall outside this range, expand dynamically
    tasks.forEach(t => {
      const ts = new Date(t.startDate);
      const td = new Date(t.dueDate);
      if (ts < start && ts.getFullYear() === 2026) start = ts;
      if (td > end && td.getFullYear() === 2026) end = td;
    });

    // Add padding days
    start = new Date(start.getTime() - 2 * 24 * 60 * 60 * 1000);
    end = new Date(end.getTime() + 4 * 24 * 60 * 60 * 1000);

    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const dates: Date[] = [];
    for (let i = 0; i < diffDays; i++) {
      dates.push(new Date(start.getTime() + i * 24 * 60 * 60 * 1000));
    }

    return {
      minDate: start,
      maxDate: end,
      totalDays: diffDays,
      dateList: dates
    };
  }, [tasks]);

  const formatDateLabel = (date: Date) => {
    const monthsThai = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    return `${date.getDate()} ${monthsThai[date.getMonth()]}`;
  };

  const getPositionStyles = (startDateStr: string, dueDateStr: string) => {
    const taskStart = new Date(startDateStr);
    const taskDue = new Date(dueDateStr);

    const startOffsetTime = taskStart.getTime() - minDate.getTime();
    const durationTime = taskDue.getTime() - taskStart.getTime();

    const startOffsetDays = startOffsetTime / (1000 * 60 * 60 * 24);
    const durationDays = Math.max(1, Math.ceil(durationTime / (1000 * 60 * 60 * 24)) + 1);

    const leftPercent = (startOffsetDays / totalDays) * 100;
    const widthPercent = (durationDays / totalDays) * 100;

    return {
      left: `${Math.max(0, leftPercent)}%`,
      width: `${Math.min(100 - leftPercent, widthPercent)}%`
    };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed': return 'bg-emerald-500 border-emerald-600';
      case 'In Progress': return 'bg-indigo-500 border-indigo-600';
      case 'On Hold': return 'bg-rose-500 border-rose-600';
      default: return 'bg-slate-400 border-slate-500';
    }
  };

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case 'Completed': return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'In Progress': return 'bg-indigo-50 text-indigo-800 border-indigo-200';
      case 'On Hold': return 'bg-rose-50 text-rose-800 border-rose-200';
      default: return 'bg-slate-50 text-slate-800 border-slate-200';
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs space-y-6" id="gantt-chart-container">
      {/* Title & Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h2 className="text-lg font-bold text-slate-900">📊 แผนภูมิแกนต์เชิงโต้ตอบ (Interactive Gantt Chart)</h2>
          <p className="text-xs text-slate-500 mt-1">แสดงตารางเวลาการทำงาน ความสัมพันธ์ของงาน (Dependencies) และการตรวจสอบสถานะ</p>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 text-xs">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-md bg-emerald-500 block"></span>เสร็จสิ้น</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-md bg-indigo-500 block"></span>กำลังดำเนินงาน</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-md bg-rose-500 block"></span>ระงับงาน</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-md bg-slate-400 block"></span>ยังไม่เริ่ม</span>
        </div>
      </div>

      {/* Advanced Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100" id="gantt-filters">
        <div>
          <label className="block text-[11px] font-bold text-slate-500 mb-1 flex items-center gap-1">
            <Briefcase size={12} /> กรองตามโครงการ
          </label>
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="w-full text-xs px-2.5 py-2 border border-slate-200 rounded-lg bg-white"
          >
            <option value="All">ทุกโครงการ ({projects.length - 1})</option>
            {projects.filter(p => p !== 'All').map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-500 mb-1 flex items-center gap-1">
            <Filter size={12} /> กรองตามแผนก
          </label>
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="w-full text-xs px-2.5 py-2 border border-slate-200 rounded-lg bg-white"
          >
            <option value="All">ทุกแผนก ({departments.length - 1})</option>
            {departments.filter(d => d !== 'All').map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-500 mb-1 flex items-center gap-1">
            <Users size={12} /> ผู้รับผิดชอบหลัก
          </label>
          <select
            value={selectedOwner}
            onChange={(e) => setSelectedOwner(e.target.value)}
            className="w-full text-xs px-2.5 py-2 border border-slate-200 rounded-lg bg-white"
          >
            <option value="All">พนักงานทุกคน ({employees.length})</option>
            {employees.map(emp => (
              <option key={emp.id} value={emp.id}>{emp.name} ({emp.department})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Gantt Area */}
      {filteredTasks.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-slate-500">
          ไม่พบงานที่ตรงกับการกรองข้างต้น กรุณาปรับเปลี่ยนตัวกรองใหม่
        </div>
      ) : (
        <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-2xs">
          
          {/* Timeline Wrapper (allows horizontal scroll on the timeline side) */}
          <div className="overflow-x-auto">
            <div className="min-w-[1000px] flex flex-col">
              
              {/* Timeline Header (Months & Days) */}
              <div className="flex border-b border-slate-200 bg-slate-50/75 select-none">
                {/* Left Header Corner */}
                <div className="w-[320px] shrink-0 p-3 text-xs font-bold text-slate-500 border-r border-slate-200 self-end">
                  รายละเอียดโครงการและงาน
                </div>

                {/* Right Header Days */}
                <div className="flex-1 relative flex">
                  {dateList.map((date, idx) => {
                    const isSunday = date.getDay() === 0;
                    const isSaturday = date.getDay() === 6;
                    const isToday = date.toDateString() === new Date().toDateString();

                    return (
                      <div 
                        key={idx} 
                        className={`flex-1 text-center border-r border-slate-100 py-2.5 flex flex-col items-center justify-between min-w-[32px] ${
                          isToday ? 'bg-indigo-50/50' : (isSunday || isSaturday) ? 'bg-slate-100/50' : ''
                        }`}
                      >
                        <span className="text-[9px] font-bold uppercase text-slate-400">
                          {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'][date.getDay()]}
                        </span>
                        <span className={`text-[10px] font-bold px-1 rounded-full mt-1 ${
                          isToday ? 'bg-indigo-600 text-white font-black' : 'text-slate-600'
                        }`}>
                          {date.getDate()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Timeline Body Rows */}
              <div className="divide-y divide-slate-100">
                {filteredTasks.map((task) => {
                  const owner = employees.find(e => e.id === task.primaryOwnerId);
                  const { left, width } = getPositionStyles(task.startDate, task.dueDate);

                  // Find tasks this task depends on (Predecessors)
                  const predecessors = tasks.filter(t => task.dependencies.includes(t.id));

                  return (
                    <div key={task.id} className="flex hover:bg-slate-50/50 transition-colors group relative">
                      
                      {/* Left Side: Task Info */}
                      <div className="w-[320px] shrink-0 p-3.5 border-r border-slate-200 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-1.5 py-0.5 rounded truncate max-w-[150px]">
                              {task.project}
                            </span>
                            <span className={`text-[9px] font-extrabold px-1.5 rounded uppercase ${
                              task.priority === 'High' ? 'bg-rose-50 text-rose-700' :
                              task.priority === 'Medium' ? 'bg-amber-50 text-amber-700' :
                              'bg-slate-100 text-slate-600'
                            }`}>
                              {task.priority}
                            </span>
                          </div>

                          <h4 className="text-xs font-bold text-slate-800 mt-1.5 group-hover:text-indigo-600 transition-colors">
                            {task.title}
                          </h4>

                          {/* Owner Badge */}
                          <div className="flex items-center gap-1.5 mt-2">
                            <img src={owner?.avatar} alt="" className="w-5 h-5 rounded-full object-cover" />
                            <span className="text-[10px] text-slate-500 font-medium">
                              {owner?.name || 'ไม่ระบุผู้รับผิดชอบ'}
                            </span>
                          </div>
                        </div>

                        {/* Dates & Dependencies info */}
                        <div className="flex items-center justify-between mt-3 pt-2 border-t border-dashed border-slate-100">
                          <span className="text-[10px] text-slate-400">
                            🗓️ {task.startDate} ถึง {task.dueDate}
                          </span>
                          
                          {predecessors.length > 0 && (
                            <span 
                              className="text-[9px] bg-amber-50 text-amber-800 border border-amber-100 px-1.5 py-0.5 rounded flex items-center gap-1"
                              title={`ต้องรอให้งานเหล่านี้เสร็จก่อน: ${predecessors.map(p => p.title).join(', ')}`}
                            >
                              🔗 มีสายสัมพันธ์ ({predecessors.length})
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right Side: Timeline Visualization Row */}
                      <div className="flex-1 relative min-h-[96px] bg-slate-50/10">
                        {/* Day Columns BG Lines */}
                        <div className="absolute inset-0 flex pointer-events-none">
                          {dateList.map((date, idx) => {
                            const isSunday = date.getDay() === 0;
                            const isSaturday = date.getDay() === 6;
                            const isToday = date.toDateString() === new Date().toDateString();

                            return (
                              <div 
                                key={idx} 
                                className={`flex-1 border-r border-slate-100 h-full min-w-[32px] ${
                                  isToday ? 'bg-indigo-50/10 border-r-indigo-200/40' : (isSunday || isSaturday) ? 'bg-slate-100/10' : ''
                                }`}
                              ></div>
                            );
                          })}
                        </div>

                        {/* Connection visual lines placeholder (simulated connector lines inside chart) */}
                        {predecessors.map((p, pIdx) => {
                          const pOwner = employees.find(e => e.id === p.primaryOwnerId);
                          return (
                            <div 
                              key={p.id}
                              className="absolute top-1 left-3 bg-amber-100/80 text-[9px] text-amber-800 px-1.5 py-0.5 rounded-full border border-amber-200/60 flex items-center gap-1 z-10"
                              style={{ transform: `translateY(${pIdx * 18}px)` }}
                            >
                              <span>ผูกโยงต่อจาก:</span>
                              <span className="font-bold">{p.title}</span>
                              <span className="text-amber-500">({p.status})</span>
                            </div>
                          );
                        })}

                        {/* Actual Task Gantt Bar */}
                        <div 
                          className="absolute top-1/2 -translate-y-1/2 p-1"
                          style={{ left, width }}
                        >
                          <div 
                            className={`h-7 rounded-lg border shadow-xs relative flex items-center px-2 select-none group/bar cursor-pointer ${getStatusColor(task.status)}`}
                          >
                            {/* Process Progress fill background */}
                            <div 
                              className="absolute top-0 left-0 bottom-0 bg-white/20 rounded-l-lg transition-all duration-500"
                              style={{ width: `${task.progress}%` }}
                            ></div>

                            {/* Task Name & Progress details */}
                            <div className="relative text-[10px] text-white font-semibold flex items-center justify-between w-full truncate gap-2">
                              <span className="truncate">{task.title}</span>
                              <span className="bg-black/25 text-white text-[9px] px-1 py-0.2 rounded shrink-0">
                                {task.progress}%
                              </span>
                            </div>

                            {/* Tooltip on hover */}
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-slate-900 text-white rounded-lg p-2.5 text-[11px] shadow-lg opacity-0 pointer-events-none group-hover/bar:opacity-100 transition-opacity z-20 space-y-1">
                              <p className="font-bold text-slate-200 truncate">{task.title}</p>
                              <p className="text-slate-400">โครงการ: {task.project}</p>
                              <p className="text-slate-400">ผู้รับผิดชอบ: {owner?.name}</p>
                              <p className="text-slate-400">กำหนด: {task.startDate} ถึง {task.dueDate}</p>
                              <div className="flex justify-between items-center pt-1 border-t border-slate-800 mt-1">
                                <span className="font-semibold text-indigo-300">ความก้าวหน้า {task.progress}%</span>
                                <span className="text-slate-300">[{task.status}]</span>
                              </div>
                            </div>
                          </div>
                        </div>

                      </div>

                    </div>
                  );
                })}
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Guide/Instruction Footer */}
      <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl flex items-start gap-3">
        <HelpCircle className="text-indigo-600 shrink-0 mt-0.5" size={18} />
        <div className="text-xs text-slate-600 space-y-1">
          <p className="font-semibold text-slate-800">เกี่ยวกับแผนภูมิแกนต์และสายสัมพันธ์ของงาน (Gantt Guide)</p>
          <p>• แท่งแผนภูมิถูกระบายสีตามสถานะงาน: แท่งสีเขียวคือเสร็จแล้ว (Completed) แท่งสีน้ำเงินคืออยู่ระหว่างการพัฒนางาน (In Progress)</p>
          <p>• พื้นที่หลังคาแท่งใสทึบด้านใน แสดงถึงเปอร์เซ็นต์ความคืบหน้า (0-100%) ที่พนักงานกรอกอัปเดตงานแบบทันที</p>
          <p>• หากงานใดพึ่งพางานอื่น (Dependencies) จะมีการแจ้งเตือนความเกี่ยวเนื่องและคำเตือนเพื่อจัดส่งต่อสเตจงานในแถบปีกขวา</p>
        </div>
      </div>

    </div>
  );
}
