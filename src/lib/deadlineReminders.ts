// "เตือนฉันก่อนกำหนด" — how many days before a task's due date (or a project's end date) someone wants
// to be reminded. It's personal and per item: each person picks it for each task/project inside that
// item's own modal, and the list is stored in the deadline_reminder table as whole days, e.g. [1, 7, 30].
// Limits mirror server/lib/notificationCategories.ts.

export const MAX_REMINDER_COUNT = 6;
export const MAX_REMINDER_DAYS = 365;

// What applies until someone customises it: remind once when 2 days (or fewer) are left — the
// behaviour the app always had, so nobody's notifications change until they choose to.
export const DEFAULT_DEADLINE_REMINDER_DAYS: number[] = [2];

// One-tap choices in the reminder picker (days → label). Anything else is a "custom" value.
export const REMINDER_PRESETS: { days: number; label: string }[] = [
  { days: 1, label: '1 วัน' },
  { days: 3, label: '3 วัน' },
  { days: 7, label: '7 วัน' },
  { days: 30, label: '1 เดือน' },
  { days: 90, label: '3 เดือน' },
];

export type ReminderUnit = 'day' | 'week' | 'month';
export const REMINDER_UNIT_DAYS: Record<ReminderUnit, number> = { day: 1, week: 7, month: 30 };
export const REMINDER_UNIT_LABEL: Record<ReminderUnit, string> = { day: 'วัน', week: 'สัปดาห์', month: 'เดือน' };

// A month here is 30 days — the presets and custom entries use the same convention.
export function formatReminderLead(days: number): string {
  const preset = REMINDER_PRESETS.find((p) => p.days === days);
  if (preset) return preset.label;
  if (days % 30 === 0) return `${days / 30} เดือน`;
  if (days % 7 === 0) return `${days / 7} สัปดาห์`;
  return `${days} วัน`;
}

// Which reminder (if any) applies to a task that is `daysUntilDue` days away right now: the smallest
// chosen lead time that is still ≥ the days left. So with [1, 7] a task 5 days out matches the "7"
// reminder and a task due tomorrow matches "1" — one notification per lead time, never a burst of
// every threshold at once when someone opens the app late. Returns null when nothing applies (task
// further out than every lead time, or no reminders chosen).
export function pickReminderLead(daysUntilDue: number, leadDays: number[]): number | null {
  if (daysUntilDue < 0) return null;
  const candidates = leadDays.filter((n) => n >= daysUntilDue).sort((a, b) => a - b);
  return candidates.length > 0 ? candidates[0] : null;
}

export function normalizeReminderDays(days: number[]): number[] {
  return [...new Set(days.filter((d) => Number.isInteger(d) && d >= 1 && d <= MAX_REMINDER_DAYS))].sort((a, b) => a - b).slice(0, MAX_REMINDER_COUNT);
}

// Validates one custom entry from the Settings form. Returns the value in days or an error message.
export function parseCustomReminder(amount: string, unit: ReminderUnit): { days: number } | { error: string } {
  const n = Number(amount);
  if (!amount.trim() || !Number.isInteger(n) || n < 1) return { error: 'กรอกเป็นจำนวนเต็มตั้งแต่ 1 ขึ้นไป' };
  const days = n * REMINDER_UNIT_DAYS[unit];
  if (days > MAX_REMINDER_DAYS) return { error: `เตือนล่วงหน้าได้ไม่เกิน ${MAX_REMINDER_DAYS} วัน (ประมาณ 12 เดือน)` };
  return { days };
}

// Lookup key for one project's/task's personal choice in the client-side map (AppDataContext).
export type ReminderEntityType = 'project' | 'task';
export type ReminderMap = Record<string, number[]>;
export const reminderKey = (type: ReminderEntityType, id: string) => `${type}:${id}`;

// What applies to one item for the current person: their own choice for it, else the app default.
export function reminderLeadsFor(map: ReminderMap, type: ReminderEntityType, id: string): number[] {
  return map[reminderKey(type, id)] ?? DEFAULT_DEADLINE_REMINDER_DAYS;
}

// Short text for a list of lead times, e.g. "7 วัน, 1 เดือน" — used on the picker's trigger button.
export function summarizeReminderLeads(days: number[]): string {
  return days.length === 0 ? 'ไม่เตือนล่วงหน้า' : days.map(formatReminderLead).join(', ');
}

// --- Notification ids ------------------------------------------------------------------------
// notification.id is the table's PRIMARY KEY — one namespace for everybody — and a duplicate insert is
// treated as "already sent". So an id has to name the RECIPIENT too, or the second person on a task
// (or project) finds the first person's row in the way and never gets a notification of their own.
// Each id also carries the lead time and the deadline it was sent for, so moving a deadline earns a
// fresh reminder while re-scanning the same one never repeats it.
export type ReminderItemKind = 'task' | 'project';
const KIND_PREFIX: Record<ReminderItemKind, string> = { task: 'nd', project: 'np' };

export const dueSoonNotificationId = (kind: ReminderItemKind, me: string, itemId: string, lead: number, deadlineISO: string) =>
  `${KIND_PREFIX[kind]}_${me}_${itemId}_${lead}_${deadlineISO}`;

export const overdueNotificationId = (me: string, taskId: string) => `no_${me}_${taskId}`;

// The tightest lead this person was already reminded at for this item's current deadline (null if
// never). Used so that widening or changing the lead times never re-announces something already
// announced closer to the deadline. Tasks announced before per-item settings existed used the id
// `notif_duesoon_<taskId>` (always the 2-day lead, no deadline in the id) — recognised here too.
export function closestRemindedLead(existingIds: string[], kind: ReminderItemKind, me: string, itemId: string, deadlineISO: string): number | null {
  const head = `${KIND_PREFIX[kind]}_${me}_${itemId}_`;
  const tail = `_${deadlineISO}`;
  let best: number | null = null;
  for (const id of existingIds) {
    let lead: number | null = null;
    if (id.startsWith(head) && id.endsWith(tail) && id.length > head.length + tail.length) {
      const n = Number(id.slice(head.length, id.length - tail.length));
      if (Number.isInteger(n)) lead = n;
    } else if (kind === 'task' && id === `notif_duesoon_${itemId}`) {
      lead = 2;
    }
    if (lead !== null && (best === null || lead < best)) best = lead;
  }
  return best;
}
