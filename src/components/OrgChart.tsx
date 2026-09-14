import { useEffect, useMemo, useRef, useState, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Users2, Pencil, Trash2, Plus, X, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { Employee } from '../types';
import { COMPANY_NAME, OrgDivisionData, resolveOrgPlacement } from '../data/orgStructure';
import { getAvatarColor } from '../lib/avatarColor';
import Dropdown from './Dropdown';

function displayName(emp: Employee) {
  return emp.nickname || emp.name;
}

// A single person row embedded inside a division/section card — same shape as the task rows
// embedded inside each member's card on the project detail page's "ทีม" tab (avatar/dot + a
// two-line text block), just showing a person instead of a task.
function MemberRow({ employee }: { employee: Employee }) {
  return (
    <div className="flex items-center gap-2 text-left">
      {employee.avatar ? (
        <img src={employee.avatar} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
      ) : (
        <span
          className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
          style={{ backgroundColor: getAvatarColor(displayName(employee)) }}
        >
          {displayName(employee).trim().charAt(0).toUpperCase()}
        </span>
      )}
      <div className="min-w-0">
        <p className="text-xs text-[#272220] truncate">{displayName(employee)}</p>
        <p className="text-[10px] text-[#A0A0A0] truncate">{employee.role}</p>
      </div>
    </div>
  );
}

function MemberList({ members }: { members: Employee[] }) {
  if (members.length === 0) return null;
  return (
    <div className="w-full pt-3 mt-1 border-t border-slate-50 space-y-2">
      {members.map((m) => (
        <MemberRow key={m.id} employee={m} />
      ))}
    </div>
  );
}

// A flat pill (not a card row) — only used for the bottom "ยังไม่ระบุฝ่าย" bucket, which isn't
// part of the tree so it doesn't get a card of its own.
function MemberChip({ employee }: { employee: Employee }) {
  return (
    <div className="flex items-center gap-1.5 bg-[#F9F9F9] border border-slate-100 rounded-xl pl-1 pr-2.5 py-1">
      {employee.avatar ? (
        <img src={employee.avatar} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
      ) : (
        <span
          className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
          style={{ backgroundColor: getAvatarColor(displayName(employee)) }}
        >
          {displayName(employee).trim().charAt(0).toUpperCase()}
        </span>
      )}
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-[#272220] leading-tight truncate max-w-24">{displayName(employee)}</p>
        <p className="text-[9px] text-[#A0A0A0] leading-tight truncate max-w-24">{employee.role}</p>
      </div>
    </div>
  );
}

// Generic "one parent, N children" branch connector — a horizontal bar forking into a vertical
// drop per child, trimmed so it never overhangs past the outer children. Each half-border extends
// exactly `gapPx / 2` past its own child's edge to meet its neighbor's, which lines up perfectly
// regardless of how many children there are or how wide each one renders. Deliberately never
// forces a fixed width on a child slot — the flex `gap` between items is what keeps neighboring
// columns from touching, no matter how wide any one column's own content ends up being (this is
// what a fixed-width slot got wrong before: a division with wider content than its own slot spilled
// sideways into the next one).
export function ForkRow<T>({
  items,
  keyOf,
  gapPx,
  itemClassName,
  renderItem,
}: {
  items: T[];
  keyOf: (item: T) => string;
  gapPx: number;
  itemClassName?: string;
  renderItem: (item: T, idx: number) => ReactNode;
}) {
  const halfGap = gapPx / 2;
  return (
    <div className="flex" style={{ gap: gapPx }}>
      {items.map((item, idx) => (
        <div key={keyOf(item)} className={`relative flex flex-col items-center shrink-0 ${itemClassName ?? ''}`}>
          {idx > 0 && (
            <div className="absolute top-0 border-t border-slate-300" style={{ left: -halfGap, right: '50%' }} />
          )}
          {idx < items.length - 1 && (
            <div className="absolute top-0 border-t border-slate-300" style={{ left: '50%', right: -halfGap }} />
          )}
          <div className="w-px h-6 bg-slate-300" />
          {renderItem(item, idx)}
        </div>
      ))}
    </div>
  );
}

// Small reusable rename/add prompt — used for every "add ฝ่าย/แผนก" and "rename ฝ่าย/แผนก" action.
function NamePromptModal({
  title,
  label,
  initialValue = '',
  onSave,
  onClose,
}: {
  title: string;
  label: string;
  initialValue?: string;
  onSave: (value: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(initialValue);
  return createPortal(
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-50 flex items-center justify-center">
        <motion.div
          className="absolute inset-0 bg-black/15 backdrop-blur-sm"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-5"
        >
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-bold text-slate-800">{title}</h3>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer" type="button">
              <X size={18} />
            </button>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (value.trim()) onSave(value.trim());
            }}
          >
            <label className="block text-[#272220] font-bold text-[11px] mb-1">{label}</label>
            <input
              type="text"
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full p-2.5 text-sm border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#FF6537]"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button type="button" onClick={onClose} className="px-4 h-9 text-xs font-semibold text-[#6F6F6F] hover:bg-slate-50 rounded-lg border border-[#E5E5E5] cursor-pointer">
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={!value.trim()}
                className={`px-4 h-9 text-white font-bold text-xs rounded-lg ${value.trim() ? 'bg-[#FF6537] hover:bg-[#e6572c] cursor-pointer' : 'bg-[#F68C6C] cursor-not-allowed'}`}
              >
                บันทึก
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}

// Two-step inline confirm (click once to arm, click again to confirm) instead of a full modal —
// used for both division and section deletes, which happen from small icon buttons inside boxes.
function DeleteButton({ onConfirm, warning }: { onConfirm: () => void; warning?: string }) {
  const [armed, setArmed] = useState(false);
  if (armed) {
    return (
      <div className="absolute -top-2 -right-2 z-10 flex items-center gap-1 bg-white border border-rose-200 rounded-full shadow-md px-1.5 py-1" title={warning}>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onConfirm(); setArmed(false); }}
          className="text-[9px] font-bold text-rose-600 hover:text-rose-800 cursor-pointer px-1"
        >
          ลบ?
        </button>
        <button type="button" onClick={(e) => { e.stopPropagation(); setArmed(false); }} className="text-slate-400 hover:text-slate-600 cursor-pointer">
          <X size={11} />
        </button>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); setArmed(true); }}
      className="absolute -top-2 -right-2 z-10 w-5 h-5 flex items-center justify-center rounded-full bg-white border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-200 shadow-sm cursor-pointer"
      title="ลบ"
    >
      <Trash2 size={10} />
    </button>
  );
}

function EditButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute -top-2 -left-2 z-10 w-5 h-5 flex items-center justify-center rounded-full bg-white border border-slate-200 text-slate-400 hover:text-[#FF6537] hover:border-[#FF6537] shadow-sm cursor-pointer"
      title="แก้ไขชื่อ"
    >
      <Pencil size={10} />
    </button>
  );
}

interface DivisionColumn {
  division: OrgDivisionData;
  sectionMembers: Record<string, Employee[]>; // section name -> members placed precisely there
  generalMembers: Employee[]; // members placed at the division level with no specific section signal
}

interface OrgChartProps {
  employees: Employee[];
  orgDivisions: OrgDivisionData[];
  onAddDivision: (name: string) => void;
  onRenameDivision: (oldName: string, newName: string) => void;
  onDeleteDivision: (name: string) => void;
  onAddSection: (divisionName: string, sectionName: string) => void;
  onRenameSection: (divisionName: string, oldName: string, newName: string) => void;
  onDeleteSection: (divisionName: string, sectionName: string) => void;
}

// Static-shaped org chart template — always renders every division and its sections regardless of
// real employee data, then layers real employees on top wherever `resolveOrgPlacement` can
// confidently place them. The structure itself (divisions/sections) is admin-editable in place
// via the pencil/trash/+ controls that appear when "แก้ไขโครงสร้าง" is switched on. Card styling
// (white bg, subtle/orange border, shadow, embedded member rows) matches the org chart on a
// project's own "ทีม" tab (ProjectDetail.tsx) rather than the earlier compact fixed-size boxes.
export default function OrgChart({
  employees,
  orgDivisions,
  onAddDivision,
  onRenameDivision,
  onDeleteDivision,
  onAddSection,
  onRenameSection,
  onDeleteSection,
}: OrgChartProps) {
  const [editMode, setEditMode] = useState(false);
  const [filterDivision, setFilterDivision] = useState('__all__');
  const [renamePrompt, setRenamePrompt] = useState<
    | { kind: 'division'; oldName: string }
    | { kind: 'section'; division: string; oldName: string }
    | { kind: 'add-division' }
    | { kind: 'add-section'; division: string }
    | null
  >(null);

  const { columns, unassigned } = useMemo(() => {
    const columns: DivisionColumn[] = orgDivisions.map((division) => ({
      division,
      sectionMembers: Object.fromEntries(division.sections.map((s) => [s, []])),
      generalMembers: [],
    }));
    const byDivision = new Map(columns.map((c) => [c.division.name, c]));
    const unassigned: Employee[] = [];

    employees.forEach((emp) => {
      const placement = resolveOrgPlacement(emp.role, emp.division, emp.department, orgDivisions);
      if (!placement) {
        unassigned.push(emp);
        return;
      }
      const col = byDivision.get(placement.division);
      if (!col) return;
      if (placement.section) col.sectionMembers[placement.section]?.push(emp);
      else col.generalMembers.push(emp);
    });

    return { columns, unassigned };
  }, [employees, orgDivisions]);

  const visibleColumns = filterDivision === '__all__' ? columns : columns.filter((c) => c.division.name === filterDivision);

  const countEmployeesFor = (predicate: (emp: Employee) => boolean) => employees.filter(predicate).length;

  // --- Pan & zoom canvas (drag to pan, wheel/buttons to zoom — same idea as draw.io) ---
  const [view, setView] = useState({ x: 24, y: 24, scale: 1 });
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Natural (unscaled) content size — `ResizeObserver`'s `contentRect` reports layout size, which
  // a CSS `transform: scale(...)` doesn't affect, so this stays accurate at any zoom level without
  // needing to divide out the current scale by hand. Used below to keep at least part of the chart
  // always overlapping the viewport — a flat pixel clamp (e.g. ±3000px either axis) sounds safe but
  // isn't: it's easy to drag the whole (often much wider) chart clean past the viewport edge while
  // still "inside" that generic box, leaving the canvas showing nothing but its own blank
  // background — which reads exactly like a white-screen crash even though the app is fine.
  const [contentSize, setContentSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const node = contentRef.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setContentSize({ width, height });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // At least this many px of the chart must stay visible on each axis, however far it's panned —
  // large enough that a stray drag still leaves a recognizable chunk of the tree on screen,
  // not just a sliver that reads as "did this break?".
  const MIN_OVERLAP = 240;
  const clampView = (x: number, y: number, scale: number) => {
    const viewport = viewportRef.current?.getBoundingClientRect();
    if (!viewport || contentSize.width === 0) return { x, y };
    const scaledW = contentSize.width * scale;
    const scaledH = contentSize.height * scale;
    return {
      x: Math.min(viewport.width - MIN_OVERLAP, Math.max(MIN_OVERLAP - scaledW, x)),
      y: Math.min(viewport.height - MIN_OVERLAP, Math.max(MIN_OVERLAP - scaledH, y)),
    };
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      // Read dragRef.current once, up front, into plain numbers — `setView`'s updater callback
      // can run after this handler returns (React defers it), by which point a `mouseup` may
      // already have nulled dragRef.current out from under it. Re-reading `dragRef.current!`
      // *inside* that callback was exactly this bug: the `!` doesn't make it true, it just moves
      // the null-check failure from a caught `if` into an uncaught "Cannot read properties of
      // null" crash a moment later.
      const drag = dragRef.current;
      if (!drag) return;
      const rawX = drag.origX + (e.clientX - drag.startX);
      const rawY = drag.origY + (e.clientY - drag.startY);
      setView((v) => ({ ...v, ...clampView(rawX, rawY, v.scale) }));
    };
    const onUp = () => { dragRef.current = null; setIsDragging(false); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentSize]);

  const zoomAt = (cx: number, cy: number, factor: number) => {
    setView((v) => {
      const newScale = Math.min(2.5, Math.max(0.3, v.scale * factor));
      const ratio = newScale / v.scale;
      const next = clampView(cx - (cx - v.x) * ratio, cy - (cy - v.y) * ratio, newScale);
      return { scale: newScale, ...next };
    });
  };

  // A filter change can swap in dramatically smaller/differently-placed content (e.g. "ทุกฝ่าย"
  // down to a single division) — reset the view instead of leaving the old pan/zoom pointed at
  // wherever the wider chart used to be, which could easily be nowhere near the filtered result.
  useEffect(() => {
    setView({ x: 24, y: 24, scale: 1 });
  }, [filterDivision]);

  // This listener is attached once (empty dep array — see below for why) but must always call
  // the CURRENT render's `zoomAt`, which closes over the current `contentSize`/`viewportRef`
  // rect. Without this ref indirection, the effect would permanently capture the very first
  // render's `zoomAt` — which saw `contentSize.width === 0` (before the ResizeObserver had
  // reported anything) — so every wheel-zoom afterward would silently skip the pan clamp below,
  // even though drag-panning correctly re-subscribed and used it.
  const zoomAtRef = useRef(zoomAt);
  zoomAtRef.current = zoomAt;

  // React attaches JSX `onWheel` as a passive listener, so `e.preventDefault()` inside it is
  // silently ignored (console warning only) — the page keeps scrolling underneath while this
  // zooms the canvas. Enough accumulated scroll lands the whole page on blank space below/beside
  // the app content, which looks exactly like a white-screen crash. A real (non-passive) listener
  // attached directly to the DOM node is the only way to actually block that background scroll.
  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return;
    const onWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      const rect = node.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      zoomAtRef.current(cx, cy, e.deltaY < 0 ? 1.08 : 1 / 1.08);
    };
    node.addEventListener('wheel', onWheelNative, { passive: false });
    return () => node.removeEventListener('wheel', onWheelNative);
  }, []);

  const handleZoomButton = (factor: number) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    zoomAt(rect ? rect.width / 2 : 0, rect ? rect.height / 2 : 0, factor);
  };

  const resetView = () => setView({ x: 24, y: 24, scale: 1 });

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-[0px_2px_7px_-1px_rgba(0,0,0,0.1)] overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 p-4 border-b border-slate-100">
        <div className="w-44 h-9">
          <Dropdown<string>
            value={filterDivision}
            onChange={setFilterDivision}
            size="compact"
            options={[{ value: '__all__', label: 'ทุกฝ่าย' }, ...orgDivisions.map((d) => ({ value: d.name, label: d.name }))]}
          />
        </div>

        <div className="flex items-center gap-2">
          {editMode && (
            <button
              type="button"
              onClick={() => setRenamePrompt({ kind: 'add-division' })}
              className="flex items-center gap-1 h-9 px-3 rounded-lg text-xs font-semibold text-[#FF6537] border border-[#FF6537] hover:bg-[#FFF1EC] cursor-pointer"
            >
              <Plus size={13} /> เพิ่มฝ่าย
            </button>
          )}
          <button
            type="button"
            onClick={() => setEditMode((v) => !v)}
            className={`flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
              editMode ? 'bg-[#FF6537] text-white' : 'bg-[#F4F4F5] text-[#6F6F6F] hover:bg-slate-200'
            }`}
          >
            <Pencil size={13} /> {editMode ? 'เสร็จสิ้นการแก้ไข' : 'แก้ไขโครงสร้าง'}
          </button>
        </div>
      </div>

      <div
        ref={viewportRef}
        className={`relative h-140 overflow-hidden bg-[#FAFAFA] ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        onMouseDown={(e) => {
          dragRef.current = { startX: e.clientX, startY: e.clientY, origX: view.x, origY: view.y };
          setIsDragging(true);
        }}
      >
        <div
          ref={contentRef}
          className="absolute top-0 left-0 select-none"
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`, transformOrigin: '0 0' }}
        >
          <div className="flex flex-col items-center p-8">
            <div className="bg-[#272220] text-white rounded-2xl px-8 py-3.5 font-bold text-sm shadow-[0px_4px_14px_-2px_rgba(0,0,0,0.25)] whitespace-nowrap">
              {COMPANY_NAME}
            </div>

            <div className="w-px h-6 bg-slate-300" />
            <ForkRow
              items={visibleColumns}
              keyOf={(c) => c.division.name}
              gapPx={32}
              renderItem={(col) => {
                const memberCount = countEmployeesFor((emp) => resolveOrgPlacement(emp.role, emp.division, emp.department, orgDivisions)?.division === col.division.name);
                return (
                  <div className="flex flex-col items-center">
                    <div className="relative flex flex-col items-center">
                      {editMode && (
                        <>
                          <EditButton onClick={() => setRenamePrompt({ kind: 'division', oldName: col.division.name })} />
                          <DeleteButton
                            onConfirm={() => onDeleteDivision(col.division.name)}
                            warning={memberCount > 0 ? `มีพนักงาน ${memberCount} คนในฝ่ายนี้` : undefined}
                          />
                        </>
                      )}
                      <div className="bg-white border-2 border-[#FF6537] rounded-2xl shadow-[0px_2px_7px_-1px_rgba(0,0,0,0.1)] px-6 py-4 flex flex-col items-center gap-1 min-w-40">
                        <p className="font-bold text-[#272220] text-sm text-center whitespace-nowrap" title={col.division.name}>
                          {col.division.name}
                        </p>
                        <MemberList members={col.generalMembers} />
                      </div>
                    </div>

                    <div className="w-px h-6 bg-slate-300" />
                    <ForkRow
                      items={col.division.sections}
                      keyOf={(s) => s}
                      gapPx={32}
                      renderItem={(section) => {
                        const membersHere = col.sectionMembers[section] ?? [];
                        return (
                          <div className="relative flex flex-col items-center">
                            {editMode && (
                              <>
                                <EditButton onClick={() => setRenamePrompt({ kind: 'section', division: col.division.name, oldName: section })} />
                                <DeleteButton onConfirm={() => onDeleteSection(col.division.name, section)} />
                              </>
                            )}
                            <div className="w-60 bg-white border border-slate-100 rounded-2xl shadow-[0px_2px_7px_-1px_rgba(0,0,0,0.1)] p-4 flex flex-col items-center gap-1">
                              <p className="font-semibold text-[#272220] text-sm text-center truncate max-w-52" title={section}>
                                {section}
                              </p>
                              <MemberList members={membersHere} />
                            </div>
                          </div>
                        );
                      }}
                    />

                    {editMode && (
                      <button
                        type="button"
                        onClick={() => setRenamePrompt({ kind: 'add-section', division: col.division.name })}
                        className="mt-3 flex items-center gap-1 h-7 px-2.5 rounded-lg text-[10px] font-semibold text-[#FF6537] border border-dashed border-[#FF6537] hover:bg-[#FFF1EC] cursor-pointer"
                      >
                        <Plus size={11} /> เพิ่มแผนก
                      </button>
                    )}
                  </div>
                );
              }}
            />

            {unassigned.length > 0 && (
              <div className="mt-8 pt-5 border-t border-slate-200 w-full max-w-md">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[#A0A0A0] mb-2">
                  <Users2 size={13} /> ยังไม่ระบุฝ่าย
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {unassigned.map((m) => (
                    <MemberChip key={m.id} employee={m} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="absolute bottom-4 right-4 flex flex-col bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden">
          <button type="button" onClick={() => handleZoomButton(1.2)} className="w-8 h-8 flex items-center justify-center text-slate-500 hover:bg-slate-50 cursor-pointer border-b border-slate-100" title="ซูมเข้า">
            <ZoomIn size={14} />
          </button>
          <button type="button" onClick={() => handleZoomButton(1 / 1.2)} className="w-8 h-8 flex items-center justify-center text-slate-500 hover:bg-slate-50 cursor-pointer border-b border-slate-100" title="ซูมออก">
            <ZoomOut size={14} />
          </button>
          <button type="button" onClick={resetView} className="w-8 h-8 flex items-center justify-center text-slate-500 hover:bg-slate-50 cursor-pointer" title="รีเซ็ตมุมมอง">
            <Maximize2 size={13} />
          </button>
        </div>
      </div>

      {renamePrompt?.kind === 'division' && (
        <NamePromptModal
          title="แก้ไขชื่อฝ่าย"
          label="ชื่อฝ่าย"
          initialValue={renamePrompt.oldName}
          onClose={() => setRenamePrompt(null)}
          onSave={(value) => { onRenameDivision(renamePrompt.oldName, value); setRenamePrompt(null); }}
        />
      )}
      {renamePrompt?.kind === 'add-division' && (
        <NamePromptModal
          title="เพิ่มฝ่ายใหม่"
          label="ชื่อฝ่าย"
          onClose={() => setRenamePrompt(null)}
          onSave={(value) => { onAddDivision(value); setRenamePrompt(null); }}
        />
      )}
      {renamePrompt?.kind === 'section' && (
        <NamePromptModal
          title="แก้ไขชื่อแผนก"
          label="ชื่อแผนก"
          initialValue={renamePrompt.oldName}
          onClose={() => setRenamePrompt(null)}
          onSave={(value) => { onRenameSection(renamePrompt.division, renamePrompt.oldName, value); setRenamePrompt(null); }}
        />
      )}
      {renamePrompt?.kind === 'add-section' && (
        <NamePromptModal
          title="เพิ่มแผนกใหม่"
          label="ชื่อแผนก"
          onClose={() => setRenamePrompt(null)}
          onSave={(value) => { onAddSection(renamePrompt.division, value); setRenamePrompt(null); }}
        />
      )}
    </div>
  );
}
