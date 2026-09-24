import { useState, useEffect, FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { X, Ban } from 'lucide-react';
import { Meeting } from '../../types';
import { useEscapeToClose } from '../../lib/useEscapeToClose';

interface CancelMeetingModalProps {
  meeting: Meeting | null;
  onClose: () => void;
  onConfirm: (id: string, updates: Partial<Meeting>, reason: string) => Promise<void>;
}

// Requires a typed reason before a meeting can be cancelled — sets status to 'cancelled' rather
// than hard-deleting the row, so the meeting still shows up (with its reason) instead of just
// disappearing from the project's "การประชุม" tab.
export default function CancelMeetingModal({ meeting, onClose, onConfirm }: CancelMeetingModalProps) {
  useEscapeToClose(Boolean(meeting), onClose);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    setReason('');
    setFormError('');
  }, [meeting]);

  if (!meeting) return null;

  const isValid = reason.trim() !== '';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isValid || isSubmitting) return;
    setFormError('');
    setIsSubmitting(true);
    try {
      await onConfirm(meeting.id, { status: 'cancelled', cancellationReason: reason.trim() }, reason.trim());
      onClose();
    } catch {
      setFormError('ยกเลิกการประชุมไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <AnimatePresence>
      {meeting && (
        <motion.div key="cancel-meeting-modal" className="fixed inset-0 z-50 flex items-center justify-center">
          <motion.div
            className="absolute inset-0 bg-black/15 backdrop-blur-sm"
            onClick={onClose}
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
            role="dialog" aria-modal="true" aria-label="ยกเลิกการประชุม" className="relative bg-white rounded-2xl shadow-[0px_12px_36px_-8px_rgba(0,0,0,0.12)] w-full max-w-sm mx-4 overflow-hidden flex flex-col"
          >
            <div className="flex justify-between items-center px-5 pt-5 pb-2 shrink-0">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <Ban size={15} className="text-red-600" /> ยกเลิกการประชุม
                </h3>
                <p className="text-[11px] text-[#6F6F6F] mt-0.5 truncate">{meeting.title}</p>
              </div>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer shrink-0" type="button">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-5 pt-3 pb-5 space-y-3">
              <div>
                <label className="block text-[#272220] font-bold text-[11px] mb-1">
                  เหตุผลที่ยกเลิก <span className="text-[#FF6537]">*</span>
                </label>
                <textarea
                  autoFocus
                  rows={3}
                  placeholder="เช่น ผู้เข้าร่วมหลักติดภารกิจ..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full p-2.5 text-sm border border-[#E5E5E5] rounded-lg placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#FF6537]"
                />
              </div>

              {formError && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{formError}</p>
              )}

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 h-10 text-sm font-semibold text-[#6F6F6F] hover:bg-slate-50 rounded-lg border border-[#E5E5E5] cursor-pointer"
                >
                  ปิด
                </button>
                <button
                  type="submit"
                  disabled={!isValid || isSubmitting}
                  className={`flex-1 h-10 text-white font-bold text-sm rounded-lg transition-colors ${
                    isValid && !isSubmitting ? 'bg-red-600 hover:bg-red-700 cursor-pointer' : 'bg-red-300 cursor-not-allowed'
                  }`}
                >
                  {isSubmitting ? 'กำลังยกเลิก...' : 'ยืนยันยกเลิก'}
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
