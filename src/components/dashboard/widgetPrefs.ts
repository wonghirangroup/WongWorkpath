export interface DashboardWidgetVisibility {
  summaryTable: boolean;
  statusChart: boolean;
  myTasks: boolean;
  workload: boolean;
}

export interface DashboardWidgetPrefs {
  visible: DashboardWidgetVisibility;
}

const STORAGE_KEY = 'unityspace_dashboard_widget_prefs';

export const DEFAULT_WIDGET_PREFS: DashboardWidgetPrefs = {
  visible: { summaryTable: true, statusChart: true, myTasks: true, workload: true },
};

// Best-effort load — a corrupted or pre-migration value in localStorage should never break the
// dashboard, so any parse/shape issue just falls back to showing every widget. A value saved
// under the old widget set (budget/investment/stageChart) simply gets ignored per-key here since
// the merge only ever reads the current key names off DEFAULT_WIDGET_PREFS.
export function loadWidgetPrefs(): DashboardWidgetPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_WIDGET_PREFS;
    const parsed = JSON.parse(raw);
    return {
      visible: { ...DEFAULT_WIDGET_PREFS.visible, ...parsed.visible },
    };
  } catch {
    return DEFAULT_WIDGET_PREFS;
  }
}

export function saveWidgetPrefs(prefs: DashboardWidgetPrefs): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}
