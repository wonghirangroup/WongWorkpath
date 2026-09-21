import { useEffect, useRef, useState } from 'react';
import { Eye, Trash2 } from 'lucide-react';
import { Employee } from '../../types';
import { ProjectRow, ProjectPriority } from './types';
import { STATUS_DOT, STATUS_LABEL, STATUS_PILL, STATUS_ICON, PROJECT_PRIORITY_META } from './statusMeta';
import { isOwner } from '../../lib/ownership';
import { useConfirm } from '../../context/ConfirmContext';
import Dropdown from '../Dropdown';
import Tooltip from '../Tooltip';
import PeopleCell from './PeopleCell';

// Dropdown is generic over string values only, so the numeric 1-5 scale is represented as
// strings here and converted back to a number right at the onUpdatePriority call site below.
const PRIORITY_DROPDOWN_OPTIONS: { value: string; label: string }[] = [
  { value: '1', label: PROJECT_PRIORITY_META[1].label },
  { value: '2', label: PROJECT_PRIORITY_META[2].label },
  { value: '3', label: PROJECT_PRIORITY_META[3].label },
  { value: '4', label: PROJECT_PRIORITY_META[4].label },
  { value: '5', label: PROJECT_PRIORITY_META[5].label },
];

function formatBudget(budget: number | null): string {
  if (budget === null) return 'ยังไม่มี';
  return `฿${budget.toLocaleString('th-TH')}`;
}

// Left-edge accent bar: reserved for urgency alone (due within 2 days, or overdue) — status
// itself is already fully carried by the pill, so this no longer doubles up on "completed".
function rowAccentColor(row: ProjectRow): string | null {
  if (row.daysUntilDue !== undefined && row.daysUntilDue <= 2) return '#F50C0C';
  return null;
}

interface ProjectTableProps {
  rows: ProjectRow[];
  employees: Employee[];
  onViewDetail: (row: ProjectRow) => void;
  // Only admin/superadmin/executive accounts can delete a project — canDelete gates whether the
  // delete icon renders at all (a plain employee sees no icon there, not just a disabled one).
  canDelete: boolean;
  onDelete: (row: ProjectRow) => void;
  onUpdatePriority: (row: ProjectRow, priority: ProjectPriority) => void;
  currentUserId: string;
  // ผู้บริหาร can always change priority inline, regardless of ownership.
  isExecutive: boolean;
}

export default function ProjectTable({ rows, employees, onViewDetail, canDelete, onDelete, onUpdatePriority, currentUserId, isExecutive }: ProjectTableProps) {
  const confirm = useConfirm();
  // Same live-measurement technique as EmployeeManagement's table wrapper — a hardcoded
  // calc(100vh - Npx) guess drifts whenever the toolbar/status-cards above it change height, so
  // this keeps the table's bottom edge matching the sidebar's real bottom edge instead of
  // guessing at it (still relevant even at 4 rows/page — e.g. a short viewport or extra rows from
  // widened priority/status pills wrapping onto two lines).
  const [tableMaxHeight, setTableMaxHeight] = useState<number>();
  const tableWrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function updateTableMaxHeight() {
      if (!tableWrapRef.current) return;
      const top = tableWrapRef.current.getBoundingClientRect().top;
      setTableMaxHeight(window.innerHeight - top - 18);
    }
    updateTableMaxHeight();
    window.addEventListener('resize', updateTableMaxHeight);
    return () => window.removeEventListener('resize', updateTableMaxHeight);
  }, [rows.length]);

  return (
    <div ref={tableWrapRef} style={{ maxHeight: tableMaxHeight }} className="bg-white rounded-2xl border border-slate-100 shadow-[0px_2px_7px_-1px_rgba(0,0,0,0.1)] overflow-x-auto overflow-y-auto">
      <table className="w-full text-sm border-collapse min-w-340">
        <thead>
          {/* Sticky lives on each <th> (not <thead>/<tr>, which position:sticky is inert on) —
              same technique as EmployeeManagement/DocVault's own list tables — so the header stays
              put while this box's own internal overflow-y scrolls the rows underneath it. */}
          <tr className="bg-[#F9F9F9] text-[12px] font-semibold text-[#000000] border-b border-[#EDEEEF] whitespace-nowrap">
            <th className="w-4 py-3 sticky top-0 z-20 bg-[#F9F9F9]"></th>
            <th className="px-4 py-3 sticky top-0 z-20 bg-[#F9F9F9]">ลำดับ</th>
            <th className="px-4 py-3 sticky top-0 z-20 bg-[#F9F9F9]">รหัส</th>
            <th className="px-4 py-3 sticky top-0 z-20 bg-[#F9F9F9]">เรื่อง</th>
            <th className="px-4 py-3 sticky top-0 z-20 bg-[#F9F9F9]">รายละเอียด</th>
            <th className="px-4 py-3 sticky top-0 z-20 bg-[#F9F9F9]">งบประมาณ</th>
            <th className="px-4 py-3 sticky top-0 z-20 bg-[#F9F9F9]">ระดับความสำคัญ</th>
            <th className="px-4 py-3 sticky top-0 z-20 bg-[#F9F9F9]">ผู้รับผิดชอบหลัก</th>
            <th className="px-4 py-3 sticky top-0 z-20 bg-[#F9F9F9]">ความคืบหน้า</th>
            <th className="px-4 py-3 sticky top-0 z-20 bg-[#F9F9F9]">วันที่เริ่ม</th>
            <th className="px-4 py-3 sticky top-0 z-20 bg-[#F9F9F9]">วันที่สิ้นสุด</th>
            <th className="px-4 py-3 sticky top-0 z-20 bg-[#F9F9F9]">สร้างเมื่อ</th>
            <th className="px-4 py-3 sticky top-0 z-20 bg-[#F9F9F9]">สถานะ</th>
            <th className="px-4 py-3 sticky top-0 z-20 bg-[#F9F9F9]">การกระทำ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const pill = STATUS_PILL[row.status];
            const StatusIcon = STATUS_ICON[row.status];
            const showDueWarning = row.daysUntilDue !== undefined && row.daysUntilDue <= 2;
            const accentColor = rowAccentColor(row);
            const owners = row.ownerEmployeeIds.map((id) => employees.find((e) => e.id === id)).filter((e): e is Employee => Boolean(e));
            // `owners` already resolved each id against the real employee list, so reusing its ids
            // here doubles as resolveValidIds — a deleted owner can't permanently lock the row.
            const canEditPriority = isExecutive || isOwner(owners.map((o) => o.id), currentUserId);
            return (
              <tr key={row.id} className="border-b border-[#EDEEEF] last:border-b-0 hover:bg-slate-50">
                <td className="py-4">
                  {accentColor && <span className="block w-1.5 h-9 rounded-full" style={{ backgroundColor: accentColor }} />}
                </td>
                <td className="px-4 py-4 text-[#6F6F6F]">{index + 1}</td>
                <td className="px-4 py-4 text-[#6F6F6F] whitespace-nowrap">{row.code}</td>
                <td className="px-4 py-4 font-medium text-[#272220]">
                  <button
                    type="button"
                    onClick={() => onViewDetail(row)}
                    className="text-left hover:text-[#FF6537] hover:underline cursor-pointer"
                  >
                    {row.title}
                  </button>
                </td>
                <td className="px-4 py-4 text-[#6F6F6F] max-w-55 truncate"><Tooltip content={row.description}><span className="block truncate">
                  {row.description || 'ยังไม่มี'}
                </span></Tooltip></td>
                <td className="px-4 py-4 text-[#272220]">{formatBudget(row.budget)}</td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="w-28">
                    <Tooltip content={canEditPriority ? undefined : 'ต้องขออนุมัติจากผู้รับผิดชอบก่อน — แก้ไขผ่านหน้ารายละเอียดโครงการ'}>
                      <Dropdown
                        value={row.priority !== undefined ? String(row.priority) : ''}
                        options={PRIORITY_DROPDOWN_OPTIONS}
                        onChange={async (value) => {
                          const newLabel = PRIORITY_DROPDOWN_OPTIONS.find((o) => o.value === value)?.label ?? value;
                          const confirmed = await confirm({
                            title: 'ยืนยันการเปลี่ยนความสำคัญ?',
                            message: `เปลี่ยนความสำคัญของโครงการ "${row.title}" เป็น "${newLabel}"`,
                            confirmLabel: 'เปลี่ยน',
                          });
                          if (confirmed) onUpdatePriority(row, Number(value) as ProjectPriority);
                        }}
                        placeholder="ยังไม่มี"
                        disabled={!canEditPriority}
                      />
                    </Tooltip>
                  </div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <PeopleCell people={owners} size={32} showRole />
                </td>
                <td className="px-4 py-4">
                  {row.progress === null ? (
                    <span className="text-[#6F6F6F]">ยังไม่มี</span>
                  ) : (
                    <div className="flex items-center gap-2 min-w-[120px]">
                      <div className="flex-1 h-2 rounded-full bg-[#F0F0F0] overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${row.progress}%`, backgroundColor: STATUS_DOT[row.status] }}
                        />
                      </div>
                      <span className="text-xs text-[#6F6F6F] w-8 text-right">{row.progress}%</span>
                    </div>
                  )}
                </td>
                <td className="px-4 py-4 text-[#272220] whitespace-nowrap">{row.startDate ?? 'ยังไม่มี'}</td>
                <td className="px-4 py-4 text-[#272220] whitespace-nowrap">
                  {showDueWarning && (
                    <p className="text-xs font-medium text-[#F50C0C] mb-0.5">
                      {row.daysUntilDue! < 0 ? 'เลยกำหนดแล้ว' : `อีก ${row.daysUntilDue} วัน`}
                    </p>
                  )}
                  {row.endDate ?? 'ยังไม่มี'}
                </td>
                <td className="px-4 py-4 text-[#272220] whitespace-nowrap">{row.createdDate ?? 'ยังไม่มี'}</td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap"
                    style={{ backgroundColor: pill.bg, color: pill.text }}
                  >
                    <StatusIcon size={12} strokeWidth={2} />
                    {STATUS_LABEL[row.status]}
                  </span>
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => onViewDetail(row)}
                      className="inline-flex items-center gap-1.5 text-[#A0A0A0] hover:text-[#FF6537] active:text-[#e2582f] text-xs font-medium cursor-pointer whitespace-nowrap transition-colors"
                    >
                      <Eye size={14} />
                      ดูรายละเอียด
                    </button>
                    {canDelete && (
                      <Tooltip content="ลบโครงการ">
                        <button
                          type="button"
                          onClick={() => onDelete(row)}
                          className="text-[#A0A0A0] hover:text-red-600 active:text-red-700 cursor-pointer transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </Tooltip>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
