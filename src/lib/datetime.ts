const THAI_MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

// "01 ก.ย. 2569"-style short Thai date (Buddhist-Era year) from a plain ISO/`yyyy-mm-dd`-prefixed
// string — the one shared formatter every date display in the app is meant to funnel through, so
// a single spot fixes format drift instead of each screen growing its own slightly different one
// (this used to live in CreateProjectModal.tsx; moved here so lib/ code — like ThaiDatePicker —
// can import it too without CreateProjectModal.tsx importing back from a would-be circular caller).
export function formatThaiDateShort(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')} ${THAI_MONTHS_SHORT[d.getMonth()]} ${d.getFullYear() + 543}`;
}

// Same short Thai date, with the "HH:mm" already present in a "YYYY-MM-DD HH:mm[:ss]" timestamp
// (e.g. audit log entries) appended — e.g. "20 ก.ย. 2569 21:35". Used anywhere a raw timestamp
// like that would otherwise be shown as-is instead of in the app's usual Thai date format.
export function formatThaiDateTimeShort(timestamp: string): string {
  if (!timestamp) return '';
  const [datePart, timePart] = timestamp.split(' ');
  const date = formatThaiDateShort(datePart);
  return timePart ? `${date} ${timePart.slice(0, 5)}` : date;
}

// toISOString() reports UTC, which drifted 7 hours behind local Thai time in every
// recorded timestamp (audit log, task history, doc/credential timestamps). This formats
// the same "YYYY-MM-DD HH:mm" shape using the browser's local time instead.
export function nowTimestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// "5 นาทีที่แล้ว"-style label for notification timestamps. The server stores those as Bangkok
// wall-clock "YYYY-MM-DD HH:mm:ss" strings (server/lib/datetime.ts), so they're pinned to +07:00
// before being compared against the browser's clock — otherwise a viewer outside Thai time would
// see every notification hours off. Older than a week falls back to a plain Thai date.
export function formatRelativeTimeTh(timestamp: string): string {
  const date = new Date(`${timestamp.replace(' ', 'T')}+07:00`);
  if (Number.isNaN(date.getTime())) return timestamp;
  const diffMinutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMinutes < 1) return 'เมื่อสักครู่';
  if (diffMinutes < 60) return `${diffMinutes} นาทีที่แล้ว`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} ชั่วโมงที่แล้ว`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} วันที่แล้ว`;
  return new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok' }).format(date);
}
