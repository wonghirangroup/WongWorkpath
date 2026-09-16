// Formats a raw digit-only string with thousands separators as the user types (e.g. "250000" ->
// "250,000"), for number-like inputs stored internally as plain digit strings rather than a JS
// number — keeps leading zeros/empty-string states exactly as typed instead of coercing them.
export function formatThousands(raw: string): string {
  if (!raw) return '';
  return Number(raw).toLocaleString('th-TH');
}
