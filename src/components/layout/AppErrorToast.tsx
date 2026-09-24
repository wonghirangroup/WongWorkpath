import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, X } from 'lucide-react';
import { useAppData } from '../../context/AppDataContext';

const AUTO_DISMISS_MS = 8000;

// App-wide "something failed" announcement — for problems the person can't see otherwise: data that
// didn't load, or a change (like renaming a ฝ่าย) whose request the server refused. Same dark toast
// family as NotificationToast so it reads as part of the same system; sits top-center so it never
// covers the bottom-right corner where new-notification toasts appear.
export default function AppErrorToast() {
  const { appError, dismissAppError } = useAppData();

  useEffect(() => {
    if (!appError) return;
    const timer = setTimeout(dismissAppError, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [appError, dismissAppError]);

  return createPortal(
    <AnimatePresence>
      {appError && (
        <motion.div
          key={appError}
          role="alert"
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ type: 'spring', stiffness: 300, damping: 24, mass: 0.9 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-60 w-[min(28rem,calc(100vw-2rem))] bg-slate-900 text-white rounded-xl shadow-xl px-4 py-3 flex items-start gap-3"
        >
          <span className="w-8 h-8 rounded-full bg-rose-500/20 text-rose-300 flex items-center justify-center shrink-0">
            <AlertTriangle size={16} aria-hidden />
          </span>
          <p className="flex-1 min-w-0 text-sm leading-snug pt-1">{appError}</p>
          <button
            type="button"
            onClick={dismissAppError}
            aria-label="ปิดข้อความแจ้งเตือน"
            className="text-slate-400 hover:text-white cursor-pointer shrink-0 pt-1"
          >
            <X size={16} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
