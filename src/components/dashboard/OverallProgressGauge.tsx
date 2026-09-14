import { ProjectRow } from '../projectBoard/types';

interface OverallProgressGaugeProps {
  projects: ProjectRow[];
  titleOverride?: string;
}

// Semi-circle gauge: same stroke-dasharray/offset technique as ProjectCard's ProgressRing,
// just drawn along a half-circle path (M...A...) instead of a full circle, cropped to its top
// half via viewBox. Color reuses the app's own status palette (completed green / on_hold amber /
// cancelled red) rather than inventing a new traffic-light scale, so "healthy vs. at-risk" reads
// consistently with every other status color in the app.
export default function OverallProgressGauge({ projects, titleOverride }: OverallProgressGaugeProps) {
  const total = projects.length;
  const scoreable = projects.filter((p) => p.progress !== null);
  const avgProgress = scoreable.length > 0
    ? Math.round(scoreable.reduce((sum, p) => sum + (p.progress ?? 0), 0) / scoreable.length)
    : 0;

  const completed = projects.filter((p) => p.status === 'completed').length;
  const delayed = projects.filter(
    (p) => (p.status === 'in_progress' || p.status === 'on_hold') && p.daysUntilDue !== undefined && p.daysUntilDue < 0
  ).length;
  const onGoing = projects.filter(
    (p) => (p.status === 'in_progress' || p.status === 'on_hold') && !(p.daysUntilDue !== undefined && p.daysUntilDue < 0)
  ).length;

  const gaugeColor = avgProgress >= 70 ? '#197A4B' : avgProgress >= 40 ? '#FFB03D' : '#FF2A04';

  const size = 180;
  const stroke = 16;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const arcLength = Math.PI * r;
  const filled = arcLength * (avgProgress / 100);
  const path = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-[0px_2px_7px_-1px_rgba(0,0,0,0.1)] h-full flex flex-col">
      <div className="mb-2">
        <h3 className="text-base font-bold text-[#272220]">{titleOverride ?? 'ความคืบหน้าภาพรวม (Overall Progress)'}</h3>
        <p className="text-xs text-[#6F6F6F]">สัดส่วนความสำเร็จของโครงการทั้งหมดที่กรองอยู่</p>
      </div>

      {total === 0 ? (
        <div className="flex-1 flex items-center justify-center text-xs text-[#A0A0A0]">ยังไม่มีโครงการในระบบ</div>
      ) : (
        <>
          <div className="flex-1 flex flex-col items-center justify-center pt-2">
            <svg width={size} height={size / 2 + stroke / 2} viewBox={`0 0 ${size} ${size / 2 + stroke / 2}`}>
              <path d={path} stroke="#F0F0F0" strokeWidth={stroke} fill="none" strokeLinecap="round" />
              <path
                d={path}
                stroke={gaugeColor}
                strokeWidth={stroke}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={arcLength}
                strokeDashoffset={arcLength - filled}
                style={{ transition: 'stroke-dashoffset 0.4s ease' }}
              />
            </svg>
            <div className="-mt-2 text-center">
              <span className="text-3xl font-bold text-[#272220]">{avgProgress}%</span>
              <p className="text-[11px] text-[#A0A0A0]">ความคืบหน้าเฉลี่ย</p>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 pt-3 border-t border-slate-100 text-center">
            <div>
              <p className="text-base font-bold text-[#272220]">{total}</p>
              <p className="text-[10px] text-[#A0A0A0]">ทั้งหมด</p>
            </div>
            <div>
              <p className="text-base font-bold" style={{ color: '#197A4B' }}>{completed}</p>
              <p className="text-[10px] text-[#A0A0A0]">เสร็จสิ้น</p>
            </div>
            <div>
              <p className="text-base font-bold" style={{ color: '#FF2A04' }}>{delayed}</p>
              <p className="text-[10px] text-[#A0A0A0]">ล่าช้า</p>
            </div>
            <div>
              <p className="text-base font-bold" style={{ color: '#0017C1' }}>{onGoing}</p>
              <p className="text-[10px] text-[#A0A0A0]">กำลังทำ</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
