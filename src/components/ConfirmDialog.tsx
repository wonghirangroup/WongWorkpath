import { useEffect, useRef, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Pencil, Trash2, X } from 'lucide-react';

export type ConfirmTone = 'default' | 'danger';

export interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  // 'danger' = a delete/remove (red, focus starts on ยกเลิก so a stray Enter can't destroy data);
  // 'default' = saving an edit (brand orange, focus starts on the confirm button).
  tone?: ConfirmTone;
}

interface ConfirmDialogProps {
  options: ConfirmOptions | null;
  onResult: (confirmed: boolean) => void;
}

// The one confirmation popup used for every edit-save and delete in the app (see ConfirmContext's
// useConfirm). Same shell as the app's other small modals — portal, `bg-black/15 backdrop-blur-sm`,
// `rounded-2xl`, `max-w-sm`, spring entrance — but layered above them (z-[70]) since it usually
// opens from inside another modal's Save/Delete button.
export default function ConfirmDialog({ options, onResult }: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const isOpen = options !== null;
  const tone: ConfirmTone = options?.tone ?? 'default';

  // Capture-phase on window so it runs before every modal's own document-level Escape handler
  // (see useEscapeToClose) and stops there — otherwise Escape would close this popup AND the
  // modal underneath it in one press.
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      e.preventDefault();
      onResult(false);
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, onResult]);

  useEffect(() => {
    if (!isOpen) return;
    (tone === 'danger' ? cancelRef : confirmRef).current?.focus();
  }, [isOpen, tone]);

  const Icon = tone === 'danger' ? Trash2 : Pencil;

  return createPortal(
    <AnimatePresence>
      {options && (
        <motion.div key="confirm-dialog" className="fixed inset-0 z-[70] flex items-center justify-center" role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
          <motion.div
            className="absolute inset-0 bg-black/15 backdrop-blur-sm"
            onClick={() => onResult(false)}
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
            className="relative bg-white rounded-2xl shadow-[0px_12px_36px_-8px_rgba(0,0,0,0.12)] w-full max-w-sm mx-4 overflow-hidden"
          >
            <div className="flex items-start gap-3 px-5 pt-5">
              <span
                className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  tone === 'danger' ? 'bg-red-50 text-red-600' : 'bg-[#FFF1EC] text-[#FF6537]'
                }`}
              >
                <Icon size={18} />
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <h3 id="confirm-dialog-title" className="text-sm font-bold text-slate-800">{options.title}</h3>
                {options.message && <div className="text-xs text-[#6F6F6F] mt-1 leading-relaxed">{options.message}</div>}
              </div>
              <button type="button" onClick={() => onResult(false)} className="text-slate-500 hover:text-slate-800 cursor-pointer shrink-0" aria-label="ปิด">
                <X size={18} />
              </button>
            </div>

            <div className="flex items-center gap-3 px-5 pt-5 pb-5">
              <button
                ref={cancelRef}
                type="button"
                onClick={() => onResult(false)}
                className="px-4 h-10 text-sm font-semibold text-[#6F6F6F] hover:bg-slate-50 rounded-lg border border-[#E5E5E5] cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
              >
                {options.cancelLabel ?? 'ยกเลิก'}
              </button>
              <button
                ref={confirmRef}
                type="button"
                onClick={() => onResult(true)}
                className={`flex-1 h-10 text-white font-bold text-sm rounded-lg transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 ${
                  tone === 'danger'
                    ? 'bg-red-600 hover:bg-red-700 focus-visible:outline-red-600'
                    : 'bg-[#FF6537] hover:bg-[#e6572c] focus-visible:outline-[#FF6537]'
                }`}
              >
                {options.confirmLabel ?? (tone === 'danger' ? 'ยืนยันลบ' : 'ยืนยัน')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
