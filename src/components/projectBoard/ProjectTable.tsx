import { Eye, Trash2 } from 'lucide-react';
import { Employee } from '../../types';
import { ProjectRow, ProjectPriority } from './types';
import { STATUS_DOT, STATUS_LABEL, STATUS_PILL, STATUS_ICON, PROJECT_PRIORITY_META } from './statusMeta';
import { getAvatarColor } from '../../lib/avatarColor';
import { displayName } from './CreateProjectModal';
import Dropdown from '../Dropdown';

const PRIORITY_DROPDOWN_OPTIONS: { value: ProjectPriority; label: string }[] = [
  { value: 'High', label: PROJECT_PRIORITY_META.High.label },
  { value: 'Medium', label: PROJECT_PRIORITY_META.Medium.label },
  { value: 'Low', label: PROJECT_PRIORITY_META.Low.label },
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
}

export default function ProjectTable({ rows, employees, onViewDetail, canDelete, onDelete, onUpdatePriority }: ProjectTableProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-[0px_2px_7px_-1px_rgba(0,0,0,0.1)] overflow-x-auto">
      <table className="w-full text-sm border-collapse min-w-340">
        <thead>
          <tr className="bg-[#F9F9F9] text-[12px] font-semibold text-[#000000] border-b border-[#EDEEEF] whitespace-nowrap">
            <th className="w-4 py-3"></th>
            <th className="px-4 py-3">ลำดับ</th>
            <th className="px-4 py-3">รหัส</th>
            <th className="px-4 py-3">เรื่อง</th>
            <th className="px-4 py-3">รายละเอียด</th>
            <th className="px-4 py-3">งบประมาณ</th>
            <th className="px-4 py-3">ระดับความสำคัญ</th>
            <th className="px-4 py-3">ผู้รับผิดชอบหลัก</th>
            <th className="px-4 py-3">ความคืบหน้า</th>
            <th className="px-4 py-3">วันที่เริ่ม</th>
            <th className="px-4 py-3">วันที่สิ้นสุด</th>
            <th className="px-4 py-3">สร้างเมื่อ</th>
            <th className="px-4 py-3">สถานะ</th>
            <th className="px-4 py-3">การกระทำ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const pill = STATUS_PILL[row.status];
            const StatusIcon = STATUS_ICON[row.status];
            const showDueWarning = row.daysUntilDue !== undefined && row.daysUntilDue <= 2;
            const accentColor = rowAccentColor(row);
            const owner = row.ownerEmployeeId ? employees.find((e) => e.id === row.ownerEmployeeId) : undefined;
            const ownerName = owner ? displayName(owner) : null;
            return (
              <tr key={row.id} className="border-b border-[#EDEEEF] last:border-b-0 hover:bg-slate-50">
                <td className="py-4">
                  {accentColor && <span className="block w-1.5 h-9 rounded-full" style={{ backgroundColor: accentColor }} />}
                </td>
                <td className="px-4 py-4 text-[#6F6F6F]">{index + 1}</td>
                <td className="px-4 py-4 text-[#6F6F6F]">{row.code}</td>
                <td className="px-4 py-4 font-medium text-[#272220]">{row.title}</td>
                <td className="px-4 py-4 text-[#6F6F6F] max-w-55 truncate" title={row.description}>
                  {row.description || 'ยังไม่มี'}
                </td>
                <td className="px-4 py-4 text-[#272220]">{formatBudget(row.budget)}</td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="w-28">
                    <Dropdown
                      value={row.priority ?? ('' as ProjectPriority)}
                      options={PRIORITY_DROPDOWN_OPTIONS}
                      onChange={(value) => onUpdatePriority(row, value)}
                      placeholder="ยังไม่มี"
                    />
                  </div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  {owner && ownerName ? (
                    <div className="flex items-center gap-2.5">
                      {owner.avatar ? (
                        <img src={owner.avatar} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                      ) : (
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                          style={{ backgroundColor: getAvatarColor(ownerName) }}
                        >
                          {ownerName.trim().charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-[#272220] font-medium truncate">{ownerName}</p>
                        <p className="text-[11px] text-[#A0A0A0] truncate">{owner.role}</p>
                      </div>
                    </div>
                  ) : (
                    <span className="text-[#6F6F6F]">ยังไม่มี</span>
                  )}
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
                      <button
                        type="button"
                        onClick={() => onDelete(row)}
                        title="ลบโครงการ"
                        className="text-[#A0A0A0] hover:text-red-600 active:text-red-700 cursor-pointer transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
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
