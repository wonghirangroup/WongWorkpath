import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { useAppData } from '../../context/AppDataContext';
import { getNotificationVisual } from './notificationVisual';
import { useOpenNotification } from './useOpenNotification';

const AUTO_DISMISS_MS = 6000;

// Corner announcement for a notification that arrived mid-session (AppDataContext decides what
// counts as new). Uses the app's standard dark toast (Design.md → Toasts) so it reads as the same
// family as every create/delete confirmation. Auto-dismisses after 6s, paused while hovered so a
// longer message can actually be read.
export default function NotificationToast() {
  const { notificationToast, dismissNotificationToast } = useAppData();
  const openNotification = useOpenNotification();
  const [isHovered, setIsHovered] = useState(false);
  const notif = notificationToast?.notification;
  const visual = notif ? getNotificationVisual(notif) : null;

  useEffect(() => {
    if (!notif || isHovered) return;
    const timer = setTimeout(dismissNotificationToast, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [notif?.id, isHovered]);

  return createPortal(
    <AnimatePresence>
      {notif && visual && (
        <motion.div
          key={notif.id}
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ type: 'spring', stiffness: 300, damping: 24, mass: 0.9 }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className="fixed bottom-6 right-6 z-60 w-[min(24rem,calc(100vw-3rem))] bg-slate-900 text-white rounded-xl shadow-xl px-4 py-3.5 flex items-start gap-3"
        >
          <span
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: visual.bg, color: visual.fg }}
          >
            <visual.Icon size={17} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-snug">{notif.title}</p>
            <p className="text-xs text-slate-300 mt-0.5 line-clamp-2">{notif.message}</p>
            <div className="flex items-center gap-3 mt-2">
              <button
                type="button"
                onClick={() => { openNotification(notif); dismissNotificationToast(); }}
                className="text-[#FF9776] font-semibold text-xs hover:underline cursor-pointer"
              >
                {notif.linkId ? 'ดูโครงการ' : 'รับทราบ'}
              </button>
              {notificationToast.moreCount > 0 && (
                <span className="text-[11px] text-slate-400">และอีก {notificationToast.moreCount} รายการที่กระดิ่ง</span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={dismissNotificationToast}
            aria-label="ปิดการแจ้งเตือน"
            className="text-slate-400 hover:text-white cursor-pointer shrink-0"
          >
            <X size={16} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
