import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { SlidersHorizontal, Plus, X } from 'lucide-react';
import { CustomProjectStatus } from './types';
import { PROJECT_STATUS_OPTIONS, STATUS_LABEL } from './statusMeta';
import { MAX_STATUS_CARDS } from './statusWidgetPrefs';
import Tooltip from '../Tooltip';
import { useConfirm } from '../../context/ConfirmContext';
import { ApiError } from '../../lib/api';

interface StatusWidgetSettingsMenuProps {
  selectedIds: string[];
  onChangeSelected: (ids: string[]) => void;
  customStatuses: CustomProjectStatus[];
  onAddCustomStatus: (label: string) => Promise<CustomProjectStatus>;
  onDeleteCustomStatus: (id: string) => Promise<void>;
}

// Same popover shell as the Dashboard's WidgetSettingsMenu (outside-click close, motion fade+
// slide panel) — here the checkboxes pick which up-to-5 statuses show as summary cards, from a
// pool of the 7 built-ins plus any custom statuses created below, instead of toggling fixed
// dashboard widgets.
export default function StatusWidgetSettingsMenu({
  selectedIds,
  onChangeSelected,
  customStatuses,
  onAddCustomStatus,
  onDeleteCustomStatus,
}: StatusWidgetSettingsMenuProps) {
  const confirm = useConfirm();
  const [isOpen, setIsOpen] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const allStatusIds = [...PROJECT_STATUS_OPTIONS, ...customStatuses.map((s) => s.id)];
  const atMax = selectedIds.length >= MAX_STATUS_CARDS;

  const toggleStatus = (id: string) => {
    if (selectedIds.includes(id)) {
      onChangeSelected(selectedIds.filter((s) => s !== id));
    } else if (!atMax) {
      onChangeSelected([...selectedIds, id]);
    }
  };

  const handleCreate = async () => {
    const label = newLabel.trim();
    if (!label || isCreating) return;
    setIsCreating(true);
    setCreateError('');
    try {
      await onAddCustomStatus(label);
      setNewLabel('');
    } catch {
      setCreateError('สร้างสถานะไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="bg-white border border-slate-200 hover:bg-slate-50 text-[#272220] text-sm font-semibold px-4 h-10 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap transition-colors"
      >
        <SlidersHorizontal size={16} /> ปรับแต่งการ์ดสถานะ
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-full mt-1.5 w-72 bg-white border border-slate-200 rounded-xl shadow-lg py-2 z-20"
          >
            <p className="px-3.5 py-1 text-[11px] font-bold text-[#6F6F6F] uppercase tracking-wide">
              เลือกการ์ดที่จะแสดง (สูงสุด {MAX_STATUS_CARDS})
            </p>
            <div className="max-h-52 overflow-y-auto">
              {allStatusIds.map((id) => {
                const isCustom = customStatuses.some((s) => s.id === id);
                const checked = selectedIds.includes(id);
                return (
                  <div key={id} className="flex items-center gap-2 px-3.5 py-2 text-sm text-[#272220] hover:bg-[#FEFAF9]">
                    <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!checked && atMax}
                        onChange={() => toggleStatus(id)}
                        className="w-3.5 h-3.5 accent-[#FF6537] cursor-pointer shrink-0 disabled:cursor-not-allowed"
                      />
                      <span className="truncate">{STATUS_LABEL[id]}</span>
                    </label>
                    {isCustom && (
                      <Tooltip content="ลบสถานะนี้">
                        <button
                          type="button"
                          onClick={async () => {
                            const confirmed = await confirm({
                              title: 'ยืนยันการลบสถานะ?',
                              message: `ลบสถานะ "${STATUS_LABEL[id]}" ออกจากระบบ`,
                              tone: 'danger',
                            });
                            if (!confirmed) return;
                            setCreateError('');
                            try {
                              await onDeleteCustomStatus(id);
                            } catch (err) {
                              // e.g. 409 — projects still use this status; the server says how many.
                              setCreateError(err instanceof ApiError ? err.message : 'ลบสถานะไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
                            }
                          }}
                          aria-label="ลบสถานะนี้"
                          className="text-slate-500 hover:text-red-600 cursor-pointer shrink-0"
                        >
                          <X size={13} />
                        </button>
                      </Tooltip>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="my-1.5 border-t border-slate-100" />
            <div className="px-3.5 pt-1.5">
              <p className="text-[11px] font-bold text-[#6F6F6F] uppercase tracking-wide mb-1.5">สร้างสถานะใหม่</p>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCreate(); } }}
                  placeholder="ชื่อสถานะ เช่น รอเซ็นสัญญา"
                  className="flex-1 min-w-0 h-9 px-2.5 text-sm border border-[#E5E5E5] rounded-lg placeholder:text-[#767676] focus:outline-none focus:border-[#FF6537]"
                />
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={!newLabel.trim() || isCreating}
                  className="w-9 h-9 shrink-0 rounded-lg bg-[#FF6537] hover:opacity-90 text-white flex items-center justify-center cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Plus size={16} />
                </button>
              </div>
              {createError && <p className="text-[11px] text-red-600 mt-1">{createError}</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
