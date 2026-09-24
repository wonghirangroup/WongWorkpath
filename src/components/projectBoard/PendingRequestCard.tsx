import { useState } from 'react';
import { ChangeRequest } from '../../lib/api';
import { useConfirm } from '../../context/ConfirmContext';

// One row in a "คำขอที่รอดำเนินการ" list — shared by ProjectDetail's per-project panel and
// MyWorkspace's cross-project "รออนุมัติจากฉัน" tab, since both need the exact same
// approve/reject-with-note interaction. `canDecide` is false for anyone who isn't one of the
// entity's current owners — they still see the request (transparency), just without the
// approve/reject buttons.
export default function PendingRequestCard({
  request,
  entityTitle,
  requesterLabel,
  canDecide,
  onDecide,
}: {
  request: ChangeRequest;
  entityTitle: string;
  requesterLabel: string;
  canDecide: boolean;
  onDecide: (decision: 'approve' | 'reject', note?: string) => Promise<void>;
}) {
  const confirm = useConfirm();
  const [showRejectField, setShowRejectField] = useState(false);
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleApprove = async () => {
    if (isSubmitting) return;
    // Approving is what actually applies the edit or delete, so it always asks first.
    const isDelete = request.requestType === 'delete';
    const confirmed = await confirm({
      title: isDelete ? 'ยืนยันการอนุมัติให้ลบ?' : 'ยืนยันการอนุมัติให้แก้ไข?',
      message: `${requesterLabel} ขอ${isDelete ? 'ลบ' : 'แก้ไข'} "${entityTitle}" — เมื่ออนุมัติ ระบบจะ${isDelete ? 'ลบรายการนี้ออกทันที' : 'แก้ไขตามที่ขอทันที'}`,
      confirmLabel: 'อนุมัติ',
      tone: isDelete ? 'danger' : 'default',
    });
    if (!confirmed) return;
    setIsSubmitting(true);
    try { await onDecide('approve'); } finally { setIsSubmitting(false); }
  };
  const handleReject = async () => {
    if (isSubmitting || !note.trim()) return;
    setIsSubmitting(true);
    try { await onDecide('reject', note.trim()); } finally { setIsSubmitting(false); }
  };

  return (
    <div className="border border-amber-200 bg-amber-50 rounded-xl p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[#272220]">
            {requesterLabel} ขอ{request.requestType === 'edit' ? 'แก้ไข' : 'ลบ'} "{entityTitle}"
          </p>
          <p className="text-[11px] text-[#6F6F6F] mt-0.5">เหตุผล: {request.reason}</p>
        </div>
        <span className="text-[11px] font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap">รออนุมัติ</span>
      </div>

      {canDecide && (showRejectField ? (
        <div className="space-y-2 pt-1">
          <textarea
            rows={2}
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="เหตุผลที่ไม่อนุมัติ..."
            aria-label="เหตุผลที่ไม่อนุมัติ"
            className="w-full p-2 text-xs border border-red-300 rounded-lg placeholder:text-[#B0B0B0] focus:outline-none focus:border-red-500"
          />
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => { setShowRejectField(false); setNote(''); }} disabled={isSubmitting} className="px-3 h-8 text-xs font-semibold text-[#6F6F6F] hover:bg-white rounded-lg border border-[#E5E5E5] cursor-pointer">
              ย้อนกลับ
            </button>
            <button
              type="button"
              onClick={handleReject}
              disabled={isSubmitting || !note.trim()}
              className={`flex-1 h-8 text-white font-bold text-xs rounded-lg transition-colors ${note.trim() && !isSubmitting ? 'bg-red-600 hover:bg-red-700 cursor-pointer' : 'bg-red-300 cursor-not-allowed'}`}
            >
              {isSubmitting ? 'กำลังบันทึก...' : 'ยืนยันไม่อนุมัติ'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 pt-1">
          <button type="button" onClick={() => setShowRejectField(true)} disabled={isSubmitting} className="px-3 h-8 text-xs font-semibold text-red-600 hover:bg-white rounded-lg border border-red-200 cursor-pointer">
            ไม่อนุมัติ
          </button>
          <button type="button" onClick={handleApprove} disabled={isSubmitting} className="flex-1 h-8 text-white font-bold text-xs rounded-lg bg-[#197A4B] hover:bg-[#146339] cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
            {isSubmitting ? 'กำลังบันทึก...' : 'อนุมัติ'}
          </button>
        </div>
      ))}
    </div>
  );
}
