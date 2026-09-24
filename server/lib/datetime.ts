// The DB host's system clock/session time_zone is UTC (confirmed via `SELECT NOW()` vs
// `UTC_TIMESTAMP()` returning identical values), so MySQL's own CURRENT_TIMESTAMP/NOW()
// land 7 hours behind Thai wall-clock time. Every timestamp column the app writes is set
// explicitly from this instead of relying on MySQL defaults, computed via Intl against the
// Asia/Bangkok zone so it's correct regardless of the Node process's own host timezone too.
export function bangkokDateTimeFrom(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`;
}

export function nowBangkokDateTime(): string {
  return bangkokDateTimeFrom(new Date());
}

// Whole days from today (Bangkok calendar day) to a "YYYY-MM-DD" date — negative once it's past.
// "Today" is taken in Asia/Bangkok, not the Node process's own zone: Render runs in UTC, so between
// 00:00 and 07:00 Thai time the server's date was still yesterday and every deadline read a day
// further away than it really was.
export function daysUntilBangkokDate(dateOnly: string | null): number | undefined {
  if (!dateOnly) return undefined;
  const target = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateOnly);
  if (!target) return undefined;
  const today = nowBangkokDateTime().slice(0, 10).split('-').map(Number);
  const targetUtc = Date.UTC(Number(target[1]), Number(target[2]) - 1, Number(target[3]));
  const todayUtc = Date.UTC(today[0], today[1] - 1, today[2]);
  return Math.round((targetUtc - todayUtc) / 86_400_000);
}

const THAI_MONTHS_SHORT =['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

// Mirrors the client's own formatThaiDateShort (projectBoard/CreateProjectModal.tsx) exactly, so
// a project's start/end/created dates keep displaying identically whether they came from the
// mock data of old or this API — no client rendering code needs to change either way.
export function formatThaiDateShort(dateOnly: string | null): string | null {
  if (!dateOnly) return null;
  const d = new Date(`${dateOnly}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return `${String(d.getDate()).padStart(2, '0')} ${THAI_MONTHS_SHORT[d.getMonth()]} ${d.getFullYear() + 543}`;
}
