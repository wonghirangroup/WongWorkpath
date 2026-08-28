// The DB host's system clock/session time_zone is UTC (confirmed via `SELECT NOW()` vs
// `UTC_TIMESTAMP()` returning identical values), so MySQL's own CURRENT_TIMESTAMP/NOW()
// land 7 hours behind Thai wall-clock time. Every timestamp column the app writes is set
// explicitly from this instead of relying on MySQL defaults, computed via Intl against the
// Asia/Bangkok zone so it's correct regardless of the Node process's own host timezone too.
export function nowBangkokDateTime(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`;
}
