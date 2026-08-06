import { useState } from 'react';
import { Employee, LeaveRequest, Task } from '../../types';
import HandoverCard from './HandoverCard';
import LeaveRequestCard from './LeaveRequestCard';

interface ActionCenterProps {
  tasks: Task[];
  employees: Employee[];
  leaveRequests: LeaveRequest[];
  onApproveHandover: (taskId: string, handoverId: string, approved: boolean, notes: string) => void;
  onApproveLeave: (leaveId: string, approved: boolean) => void;
}

export default function ActionCenter({ tasks, employees, leaveRequests, onApproveHandover, onApproveLeave }: ActionCenterProps) {
  const [approvalNotes, setApprovalNotes] = useState<Record<string, string>>({});
  const pendingHandovers = tasks.filter(t => t.handovers.some(h => h.status === 'Pending'));
  const pendingLeaveRequests = leaveRequests.filter(r => r.status === 'Pending');

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs space-y-5" id="action-center">
      <div>
        <h3 className="text-base font-bold text-slate-900">ศูนย์อนุมัติผลและส่งต่องาน</h3>
        <p className="text-xs text-slate-500">ตรวจสอบสเตจงานพนักงานและการขออนุมัติลางาน</p>
      </div>

      <div className="space-y-4">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">คำขออนุมัติส่งมอบงาน ({pendingHandovers.length})</h4>

        {pendingHandovers.length === 0 ? (
          <div className="text-center py-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400 text-xs">
            ไม่มีคำขอส่งต่องานรออนุมัติ
          </div>
        ) : (
          <div className="space-y-3">
            {pendingHandovers.map(task => {
              const pendingH = task.handovers.find(h => h.status === 'Pending');
              if (!pendingH) return null;
              return (
                <HandoverCard
                  key={task.id}
                  task={task}
                  handover={pendingH}
                  fromEmp={employees.find(e => e.id === pendingH.fromUserId)}
                  toEmp={employees.find(e => e.id === pendingH.toUserId)}
                  note={approvalNotes[pendingH.id] || ''}
                  onNoteChange={(note) => setApprovalNotes({ ...approvalNotes, [pendingH.id]: note })}
                  onApprove={(approved, notes) => onApproveHandover(task.id, pendingH.id, approved, notes)}
                />
              );
            })}
          </div>
        )}
      </div>

      <div className="space-y-4 pt-2 border-t border-slate-100">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">คำขออนุมัติลางาน ({pendingLeaveRequests.length})</h4>

        {pendingLeaveRequests.length === 0 ? (
          <div className="text-center py-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400 text-xs">
            ไม่มีคำขอลาที่รอการอนุมัติ
          </div>
        ) : (
          <div className="space-y-3">
            {pendingLeaveRequests.map(leave => (
              <LeaveRequestCard key={leave.id} leave={leave} onApprove={(approved) => onApproveLeave(leave.id, approved)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
