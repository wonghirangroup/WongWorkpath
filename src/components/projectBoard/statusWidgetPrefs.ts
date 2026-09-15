// Same localStorage-persisted-prefs pattern as dashboard/widgetPrefs.ts, applied to
// StatusSummaryCards.tsx's "which up-to-5 statuses show as cards" customization.
const STORAGE_KEY = 'unityspace_project_status_widget_prefs';

// The original 5 built-ins, excluding the 2 newer additions (รอตรวจสอบ/ไอเดีย) — per explicit
// instruction, a fresh install should keep showing exactly what it always has, not silently grow
// to 7 cards or swap one of the original 5 out.
export const DEFAULT_SELECTED_STATUS_IDS = ['in_progress', 'completed', 'on_hold', 'cancelled', 'draft'];

export const MAX_STATUS_CARDS = 5;

export function loadSelectedStatusIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SELECTED_STATUS_IDS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every((s) => typeof s === 'string')) return DEFAULT_SELECTED_STATUS_IDS;
    return parsed.slice(0, MAX_STATUS_CARDS);
  } catch {
    return DEFAULT_SELECTED_STATUS_IDS;
  }
}

export function saveSelectedStatusIds(ids: string[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids.slice(0, MAX_STATUS_CARDS)));
}
