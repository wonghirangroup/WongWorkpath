import { Eye, Flag } from 'lucide-react';
import { Employee } from '../../types';
import { ProjectRow } from './types';
import { STATUS_DOT, STATUS_LABEL, STATUS_PILL, STATUS_ICON } from './statusMeta';
import { getAvatarColor } from '../../lib/avatarColor';
import { displayName } from './CreateProjectModal';
import Tooltip from '../Tooltip';

function formatBudget(budget: number | null): string {
  if (budget === null) return 'ยังไม่มี';
  return `฿${budget.toLocaleString('th-TH')}`;
}

// SVG ring instead of a plain bar — reads at a glance from across a grid of cards the way a
// linear bar buried in a row doesn't. Track is a light neutral; the fill uses the row's own
// status color so it agrees with the dot, pill, and watermark icon everywhere else.
function ProgressRing({ progress, color }: { progress: number; color: string }) {
  const size = 84;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, progress));
  const offset = circumference * (1 - clamped / 100);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="#F0F0F0" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.4s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold text-[#272220]">{clamped}%</span>
      </div>
    </div>
  );
}

// One label/value line — used for every field the table shows, so the card carries the same
// information, just laid out for a grid tile instead of a row.
function InfoRow({ label, value, valueClassName = 'text-[#272220]' }: { label: string; value: string; valueClassName?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-[#A0A0A0] shrink-0">{label}</span>
      <span className={`font-medium text-right truncate ${valueClassName}`}>{value}</span>
    </div>
  );
}

interface ProjectCardProps {
  row: ProjectRow;
  employees: Employee[];
  onViewDetail: () => void;
}

export default function ProjectCard({ row, employees, onViewDetail }: ProjectCardProps) {
  const ringColor = STATUS_DOT[row.status];
  const pill = STATUS_PILL[row.status];
  const StatusIcon = STATUS_ICON[row.status];
  const showDueWarning = row.daysUntilDue !== undefined && row.daysUntilDue <= 2;
  const owner = row.ownerEmployeeId ? employees.find((e) => e.id === row.ownerEmployeeId) : undefined;
  const ownerName = owner ? displayName(owner) : null;

  return (
    <div className="relative bg-white rounded-2xl border border-slate-100 shadow-[0px_2px_7px_-1px_rgba(0,0,0,0.1)] p-5 space-y-3 hover:-translate-y-1 hover:shadow-lg transition-all">
      {showDueWarning && (
        <Tooltip content={row.daysUntilDue! < 0 ? 'เลยกำหนดแล้ว' : `ใกล้ครบกำหนด (อีก ${row.daysUntilDue} วัน)`}>
          <div
            className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-[#F50C0C] flex items-center justify-center shadow-md ring-2 ring-white z-10"
          >
            <Flag size={11} className="text-white fill-white" />
          </div>
        </Tooltip>
      )}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="text-[11px] text-[#A0A0A0]">{row.code}</span>
          <h3 className="font-bold text-[#272220] truncate">{row.title}</h3>
        </div>
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap shrink-0"
          style={{ backgroundColor: pill.bg, color: pill.text }}
        >
          <StatusIcon size={11} strokeWidth={2} />
          {STATUS_LABEL[row.status]}
        </span>
      </div>

      {row.description && <p className="text-xs text-[#6F6F6F] -mt-1.5">{row.description}</p>}

      <div className="flex items-center gap-4 pt-1 border-t border-slate-50">
        <ProgressRing progress={row.progress ?? 0} color={ringColor} />
        <div className="flex-1 min-w-0 space-y-1.5">
          <InfoRow label="ผู้รับผิดชอบหลัก" value={ownerName ?? 'ยังไม่มี'} />
          <InfoRow label="งบประมาณ" value={formatBudget(row.budget)} />
          <InfoRow label="วันที่เริ่ม" value={row.startDate ?? 'ยังไม่มี'} />
          <InfoRow
            label="วันที่สิ้นสุด"
            value={showDueWarning ? `${row.endDate} (${row.daysUntilDue! < 0 ? 'เลยกำหนดแล้ว' : `อีก ${row.daysUntilDue} วัน`})` : row.endDate ?? 'ยังไม่มี'}
            valueClassName={showDueWarning ? 'text-[#F50C0C]' : 'text-[#272220]'}
          />
          <InfoRow label="สร้างเมื่อ" value={row.createdDate ?? 'ยังไม่มี'} />
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-slate-50">
        {owner && ownerName ? (
          owner.avatar ? (
            <Tooltip content={ownerName}>
              <img src={owner.avatar} alt="" className="w-8 h-8 rounded-full object-cover ring-2 ring-white shrink-0" />
            </Tooltip>
          ) : (
            <Tooltip content={ownerName}>
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ring-2 ring-white shrink-0"
                style={{ backgroundColor: getAvatarColor(ownerName) }}
              >
                {ownerName.trim().charAt(0).toUpperCase()}
              </div>
            </Tooltip>
          )
        ) : (
          <span className="text-xs text-[#A0A0A0]">ยังไม่มีผู้รับผิดชอบ</span>
        )}

        <button
          type="button"
          onClick={onViewDetail}
          className="inline-flex items-center gap-1.5 border border-[#E5E5E5] text-[#A0A0A0] hover:text-[#FF6537] hover:border-[#FFD5C2] hover:bg-orange-50 active:text-[#e2582f] text-xs font-semibold rounded-lg px-3 py-1.5 cursor-pointer transition-colors shrink-0"
        >
          <Eye size={13} />
          ดูรายละเอียด
        </button>
      </div>
    </div>
  );
}
