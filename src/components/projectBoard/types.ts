// Types for the table-based "จัดการงานและโครงงาน" redesign, per the Figma export supplied for
// this page. A project list/table with 5-way status tracking.
// Both ProjectRow and ProjectTaskItem are real, DB-backed data now (server/routes/projects.ts and
// server/routes/project-tasks.ts respectively).

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
  memberEmployeeIds?: string[]; // "ผู้รับผิดชอบร่วม" — additional team members beyond the primary owner
  docFolderId?: string | null; // Doc Vault folder created for this project (its own "create folder" step) — tasks with their own "create folder" checkbox nest inside this one instead of the Drive root
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
  assigneeEmployeeIds: string[]; // real Employee.ids — a task can have more than one responsible person; "only my tasks" filtering checks membership, not equality
  reviewerEmployeeIds?: string[]; // who can review this task's submission — chosen per task, not inherited from the project owner; any ONE of them passing/rejecting is authoritative, not a consensus vote
  creatorEmployeeId?: string; // who created the task, from the "เพิ่มงาน" modal — optional since the original mock tasks predate this field
  startDate?: string | null; // pre-formatted Thai date string, or null
  dueDate: string | null; // pre-formatted Thai date string
  startDateISO?: string | null; // raw yyyy-mm-dd alongside startDate, for editing via <input type="date">
  dueDateISO?: string | null;
  daysUntilDue?: number;
  progress: number; // 0-100
  checklist: ProjectTaskChecklistItem[];
  // Single-step submit/review workflow (see MyWorkspace.tsx): the assignee submits with a note
  // and optional attached files (real Doc Vault LinkedDoc ids, tagged with this task's id), moving
  // status to 'review'; the reviewer then passes (-> 'done') or bounces it back (-> 'in_progress',
  // reviewNote set to why) — no separate history, each field just holds the latest round.
  submissionNote?: string;
  submissionFileIds?: string[];
  reviewNote?: string;
}
