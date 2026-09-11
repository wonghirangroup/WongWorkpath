// Types for the table-based "จัดการงานและโครงงาน" redesign, per the Figma export supplied for
// this page. A project list/table with 5-way status tracking.
// Projects are real, DB-backed data (see server/routes/projects.ts) — only ProjectTaskItem below
// remains local mock data (project-tasks are a later phase of the same migration).

export type ProjectStatus = 'in_progress' | 'completed' | 'on_hold' | 'cancelled' | 'draft';

export type ProjectPriority = 'High' | 'Medium' | 'Low';

export interface ProjectRow {
  id: string;
  code: string; // e.g. "PRJ-001"
  title: string;
  description?: string; // short one-line summary shown under the title in grid/card view
  department?: string; // shown as "ทีม" in the project detail meta grid
  priority?: ProjectPriority; // shown as "ความสำคัญ" in the project detail meta grid
  budget: number | null; // null renders as "ยังไม่มี" (draft projects with no figure yet)
  ownerEmployeeId: string | null; // real Employee.id — name/role/avatar are resolved from the live employee roster
  progress: number | null; // 0-100; null renders as "ยังไม่มี"
  startDate: string | null; // pre-formatted Thai date string, or null
  endDate: string | null;
  startDateISO?: string | null; // raw yyyy-mm-dd, for feeding an <input type="date"> when editing
  endDateISO?: string | null;
  createdDate: string | null; // pre-formatted Thai date string — when the project record was created
  daysUntilDue?: number; // when set and small, shows the red "อีก N วัน" line above endDate
  status: ProjectStatus;
}

// A single work item inside a project's "งาน" tab — a self-contained mock task list scoped to
// the project board module (kept separate from the app-wide `Task` type in src/types.ts, whose
// seeded mock data has no overlap with these 3 mock projects — see mockData.ts for the same
// design call already made for ProjectRow).
export type ProjectTaskStatus = 'todo' | 'in_progress' | 'review' | 'blocked' | 'done';

export interface ProjectTaskChecklistItem {
  label: string;
  done: boolean;
}

export interface ProjectTaskItem {
  id: string;
  projectId: string; // matches ProjectRow.id
  title: string;
  description?: string; // optional free-text note, from the "เพิ่มงาน" modal
  status: ProjectTaskStatus;
  priority?: 'high' | 'medium' | 'low'; // optional, from the "เพิ่มงาน" modal — same 3-level scale as CreateProjectModal's Priority
  assigneeEmployeeId: string; // a real Employee.id, so "only my tasks" filtering works for whoever is logged in
  creatorEmployeeId?: string; // who created the task, from the "เพิ่มงาน" modal — optional since the original mock tasks predate this field
  startDate?: string | null; // pre-formatted Thai date string, or null
  dueDate: string | null; // pre-formatted Thai date string
  daysUntilDue?: number;
  progress: number; // 0-100
  checklist: ProjectTaskChecklistItem[];
}
