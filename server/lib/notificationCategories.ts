// Must stay in sync with NOTIFICATION_CATEGORY_IDS in src/types.ts (the client owns the labels).
export const NOTIFICATION_CATEGORIES = ['assignment', 'review', 'blocked', 'deadline', 'meeting', 'approval'];

export function isNotificationCategory(value: unknown): value is string {
  return typeof value === 'string' && NOTIFICATION_CATEGORIES.includes(value);
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
