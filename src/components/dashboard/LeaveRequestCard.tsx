import { LeaveRequest } from '../../types';

interface LeaveRequestCardProps {
  leave: LeaveRequest;
  onApprove: (approved: boolean) => void;
}

export default function LeaveRequestCard({ leave, onApprove }: LeaveRequestCardProps) {
  return (
    <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 space-y-2 text-xs">
      <div className="flex justify-between items-start">
        <div>
          <h5 className="font-bold text-slate-900">{leave.employeeName}</h5>
          <p className="text-slate-500 mt-0.5 text-[11px]">
            ขอลา: <span className="font-medium text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">{leave.type}</span>
          </p>
        </div>
        <span className="text-[10px] bg-slate-200/70 text-slate-700 font-bold px-2 py-0.5 rounded">
          รออนุมัติ
        </span>
      </div>

      <p className="text-slate-600 italic bg-white p-2 rounded border border-slate-100">
        "{leave.notes}"
      </p>

      <p className="text-[10px] text-slate-500">
        ช่วงเวลา: <span className="font-semibold">{leave.startDate}</span> ถึง <span className="font-semibold">{leave.endDate}</span>
      </p>

      <div className="flex gap-2 justify-end pt-1">
        <button
          onClick={() => onApprove(false)}
          className="p-1 px-2.5 rounded border border-rose-200 hover:bg-rose-50 text-rose-700 font-semibold cursor-pointer"
        >
          ปฏิเสธ
        </button>
        <button
          onClick={() => onApprove(true)}
          className="p-1 px-2.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold cursor-pointer"
        >
          อนุมัติ
        </button>
      </div>
    </div>
  );
}
