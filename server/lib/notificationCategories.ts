// Must stay in sync with NOTIFICATION_CATEGORY_IDS in src/types.ts (the client owns the labels).
export const NOTIFICATION_CATEGORIES = ['assignment', 'review', 'blocked', 'deadline', 'meeting', 'approval'];

export function isNotificationCategory(value: unknown): value is string {
  return typeof value === 'string' && NOTIFICATION_CATEGORIES.includes(value);
}

// Per-user, per-task/project reminder lead times (days before the due/end date, stored in the
// deadline_reminder table) — at most 6 of them, each a whole number of days from 1 to 365. Must match
// src/lib/deadlineReminders.ts.
export const MAX_REMINDER_COUNT = 6;
export const MAX_REMINDER_DAYS = 365;
// A same-day task (start date = due date) has no day gap to count, so its lead times are minutes
// instead — stored in this very same column/array, encoded as a NEGATIVE integer (e.g. -30 = "30
// minutes before"). Safe to share one column: a single task is never in both modes at once (a
// same-day task's day-based limit is always 0, and a multi-day task has no due TIME to count
// minutes against), so the array a person saves for one item never mixes positive and negative
// entries. See src/lib/deadlineReminders.ts for the client-side encode/decode.
export const MAX_REMINDER_MINUTES = 24 * 60;

// Keeps only valid whole-day values (1–365) or valid encoded-minute values (-1440…-1),
// de-duplicated and sorted ascending. Anything else is dropped so a bad request can't store junk
// (or an absurd number of reminders).
export function sanitizeReminderDays(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const days = raw.filter(
    (d): d is number =>
      Number.isInteger(d) && ((d >= 1 && d <= MAX_REMINDER_DAYS) || (d <= -1 && d >= -MAX_REMINDER_MINUTES))
  );
  return [...new Set(days)].sort((a, b) => a - b).slice(0, MAX_REMINDER_COUNT);
}

// employee.muted_notification_categories is a JSON array (or NULL) — unknown ids are dropped so a
// stale/edited value can never widen what gets hidden.
export function parseMutedCategories(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isNotificationCategory) : [];
  } catch {
    return [];
  }
}
