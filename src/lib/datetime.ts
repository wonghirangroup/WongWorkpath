// toISOString() reports UTC, which drifted 7 hours behind local Thai time in every
// recorded timestamp (audit log, task history, doc/credential timestamps). This formats
// the same "YYYY-MM-DD HH:mm" shape using the browser's local time instead.
export function nowTimestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
