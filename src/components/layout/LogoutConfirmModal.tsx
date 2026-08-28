import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { LogOut, X } from 'lucide-react';

interface LogoutConfirmModalProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// Shared by both logout buttons (Header's user menu, Sidebar's own button) so there's exactly
// one confirmation experience regardless of which one was clicked.
export default function LogoutConfirmModal({ open, onConfirm, onCancel }: LogoutConfirmModalProps) {
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.div
            className="absolute inset-0 bg-black/15 backdrop-blur-sm"
            onClick={onCancel}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4"
          >
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-800">ออกจากระบบ</h3>
              <button type="button" onClick={onCancel} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-600">ยืนยันการออกจากระบบ? คุณจะต้องเข้าสู่ระบบใหม่อีกครั้งในการใช้งานครั้งถัดไป</p>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold cursor-pointer hover:bg-slate-50"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className="px-5 py-2 rounded-lg text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 cursor-pointer flex items-center gap-1.5"
              >
                <LogOut size={13} /> ออกจากระบบ
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
