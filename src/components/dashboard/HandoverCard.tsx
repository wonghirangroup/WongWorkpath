import { Check, X } from 'lucide-react';
import { Employee, HandoverRecord, Task } from '../../types';

interface HandoverCardProps {
  task: Task;
  handover: HandoverRecord;
  fromEmp?: Employee;
  toEmp?: Employee;
  note: string;
  onNoteChange: (note: string) => void;
  onApprove: (approved: boolean, notes: string) => void;
}

export default function HandoverCard({ task, handover, fromEmp, toEmp, note, onNoteChange, onApprove }: HandoverCardProps) {
  return (
    <div className="p-4 rounded-xl border border-amber-100 bg-amber-50/20 space-y-3 text-xs">
      <div className="flex justify-between items-start">
        <div>
          <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded">
            {task.project}
          </span>
          <h5 className="font-semibold text-slate-900 mt-1">{task.title}</h5>
          <p className="text-slate-500 mt-0.5 text-[11px]">สเตจ: <span className="font-medium text-slate-800">{handover.stageName}</span></p>
        </div>
        <span className="text-[10px] text-slate-400">{handover.timestamp.split(' ')[0]}</span>
      </div>

      <div className="bg-white p-2.5 rounded-lg border border-slate-100 text-slate-600">
        <p className="font-medium text-slate-700">บันทึกส่งต่อ:</p>
        <p className="italic">"{handover.notes}"</p>
        <div className="flex items-center gap-1 mt-2 text-[10px] text-slate-500">
          <span className="font-semibold text-indigo-600">{fromEmp?.name}</span>
          <span>👉 ส่งมอบให้</span>
          <span className="font-semibold text-indigo-600">{toEmp?.name}</span>
        </div>
      </div>

      <input
        type="text"
        placeholder="เขียนคำเห็นการอนุมัติ..."
        value={note}
        onChange={(e) => onNoteChange(e.target.value)}
        className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
      />

      <div className="flex gap-2 justify-end">
        <button
          onClick={() => onApprove(false, note || '')}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-rose-700 hover:bg-rose-50 border border-rose-200 font-medium cursor-pointer"
        >
          <X size={12} /> ปฏิเสธ
        </button>
        <button
          onClick={() => onApprove(true, note || 'อนุมัติผ่านการตรวจสอบ')}
          className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg font-medium cursor-pointer shadow-sm"
        >
          <Check size={12} /> อนุมัติสเตจ
        </button>
      </div>
    </div>
  );
}
