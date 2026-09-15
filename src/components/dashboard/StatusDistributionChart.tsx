import { ProjectRow } from '../projectBoard/types';
import { PROJECT_STATUS_OPTIONS, STATUS_DOT, STATUS_LABEL } from '../projectBoard/statusMeta';

interface StatusDistributionChartProps {
  projects: ProjectRow[];
}

// What share of the (already department/project-filtered, same as every other dashboard widget)
// project list sits in each status, as a donut.
export default function StatusDistributionChart({ projects }: StatusDistributionChartProps) {
  const total = projects.length;
  const counts = PROJECT_STATUS_OPTIONS.map((status) => ({
    status,
    count: projects.filter((p) => p.status === status).length,
  })).filter((s) => s.count > 0);

  const size = 160;
  const stroke = 22;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;

  let offsetSoFar = 0;
  const segments = counts.map(({ status, count }) => {
    const fraction = total > 0 ? count / total : 0;
    const segmentLength = circumference * fraction;
    const segment = {
      status,
      count,
      fraction,
      dasharray: `${segmentLength} ${circumference - segmentLength}`,
      dashoffset: -offsetSoFar,
    };
    offsetSoFar += segmentLength;
    return segment;
  });

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-[0px_2px_7px_-1px_rgba(0,0,0,0.1)] h-full flex flex-col">
      <div className="mb-2">
        <h3 className="text-base font-bold text-[#272220]">สัดส่วนสถานะโครงการ</h3>
        <p className="text-xs text-[#6F6F6F]">แบ่งตามสถานะของโครงการที่กรองอยู่ ({total} โครงการ)</p>
      </div>

      {total === 0 ? (
        <div className="flex-1 flex items-center justify-center text-xs text-[#A0A0A0]">ยังไม่มีโครงการในระบบ</div>
      ) : (
        <div className="flex-1 flex items-center gap-6 flex-wrap justify-center pt-2">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 shrink-0">
            <circle cx={cx} cy={cy} r={r} stroke="#F0F0F0" strokeWidth={stroke} fill="none" />
            {segments.map((seg) => (
              <circle
                key={seg.status}
                cx={cx}
                cy={cy}
                r={r}
                stroke={STATUS_DOT[seg.status]}
                strokeWidth={stroke}
                fill="none"
                strokeDasharray={seg.dasharray}
                strokeDashoffset={seg.dashoffset}
              />
            ))}
          </svg>
          <div className="space-y-1.5 min-w-32">
            {segments.map((seg) => (
              <div key={seg.status} className="flex items-center gap-2 text-xs">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: STATUS_DOT[seg.status] }} />
                <span className="text-[#6F6F6F] truncate flex-1">{STATUS_LABEL[seg.status]}</span>
                <span className="font-bold text-[#272220] shrink-0">{Math.round(seg.fraction * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
