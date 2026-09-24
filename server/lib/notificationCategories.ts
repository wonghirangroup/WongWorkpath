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

// Keeps only valid whole-day values, de-duplicated and sorted ascending. Anything else is dropped so a
// bad request can't store junk (or an absurd number of reminders).
export function sanitizeReminderDays(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const days = raw.filter((d): d is number => Number.isInteger(d) && d >= 1 && d <= MAX_REMINDER_DAYS);
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
