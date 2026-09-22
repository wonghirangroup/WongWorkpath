// Types for the table-based "จัดการงานและโครงงาน" redesign, per the Figma export supplied for
// this page. A project list/table with 5-way status tracking.
// Both ProjectRow and ProjectTaskItem are real, DB-backed data now (server/routes/projects.ts and
// server/routes/project-tasks.ts respectively).

// The 7 built-in statuses — used for the create/edit status dropdown's fixed options and as the
// key set for statusMeta.ts's base label/color/icon lookups. A project's actual `status` field
// (below) is a plain string since it can also hold a user-created custom status id (see
// CustomProjectStatus) — statusMeta.ts falls back to a hash-derived color/icon and the custom
// status's own label for anything outside this union.
export type ProjectStatus = 'in_progress' | 'completed' | 'on_hold' | 'cancelled' | 'draft' | 'pending_review' | 'idea';

// A user-defined status beyond the 7 built-ins (see StatusWidgetSettingsMenu.tsx) — real, DB-backed
// (server/routes/project-custom-statuses.ts) so it can actually be assigned to a project's own
// `status` field and filtered on, not just used as a display label.
export interface CustomProjectStatus {
  id: string;
  label: string;
}

// "ประเภทโครงการ" — feeds both a dedicated filter/label and the project code format
// ({abbreviation}-{2-digit BE year}-{type}-{sequence}, e.g. "WP-69-P-001"). The 6 built-ins below;
// a project's actual `type` field (on ProjectRow) is a plain string since it can also hold a
// user-created custom type's own abbreviation (see CustomProjectType) — statusMeta.ts's
// PROJECT_TYPE_META falls back to that custom type's own label for anything outside this union,
// same pattern as ProjectStatus/CustomProjectStatus above it.
export type ProjectType = 'P' | 'SP' | 'I' | 'C' | 'B' | 'FND';

// A user-defined project type beyond the 6 built-ins, picked via "อื่นๆ ระบุ..." in
// CreateProjectModal — real, DB-backed (server/routes/project-custom-types.ts) so it's reusable
// on future projects too, not just a one-off free-text field. `id` is the abbreviation itself
// (e.g. "MKT"), embedded into the generated project code exactly like a built-in type's own code.
export interface CustomProjectType {
  id: string;
  label: string;
}

// Numeric priority scale shared by both a project's own priority and a task's priority —
// 1 = most important, 5 = least — so the two concepts sort/compare/process identically instead
// of needing separate text scales translated at every boundary.
export type ProjectPriority = 1 | 2 | 3 | 4 | 5;

export interface ProjectRow {
  id: string;
  code: string; // e.g. "WP-69-P-001" ({abbreviation}-{2-digit BE year}-{type}-{sequence})
  title: string;
  description?: string; // short one-line summary shown under the title in grid/card view
  department?: string; // shown as "ทีม" in the project detail meta grid
  type?: string; // one of the 6 ProjectType built-ins, or a CustomProjectType.id — also embedded in the generated code
  abbreviation?: string; // "ตัวย่อชื่อโครงการ" (e.g. "GS" for Grow store) — derived from the title, user-editable, the code's first segment
  priority?: ProjectPriority; // shown as "ความสำคัญ" in the project detail meta grid
  budget: number | null; // null renders as "ยังไม่มี" (draft projects with no figure yet)
  ownerEmployeeIds: string[]; // real Employee.ids, equal authority — e.g. any one of them can approve an edit/delete request once the project has an owner. Empty array = unowned, anyone can edit/delete freely
  memberEmployeeIds?: string[]; // "ผู้รับผิดชอบร่วม" — additional team members beyond the owners
  memberDuties?: Record<string, string>; // keyed by employeeId — "หน้าที่ในโครงการนี้" per member, set alongside memberEmployeeIds
  docFolderId?: string | null; // Doc Vault folder created for this project (its own "create folder" step) — tasks with their own "create folder" checkbox nest inside this one instead of the Drive root
  progress: number | null; // 0-100; null renders as "ยังไม่มี"
  startDate: string | null; // pre-formatted Thai date string, or null
  endDate: string | null;
  startDateISO?: string | null; // raw yyyy-mm-dd, for feeding an <input type="date"> when editing
  endDateISO?: string | null;
  createdDate: string | null; // pre-formatted Thai date string — when the project record was created
  daysUntilDue?: number; // when set and small, shows the red "อีก N วัน" line above endDate
  status: string; // one of the 7 ProjectStatus built-ins, or a CustomProjectStatus.id
  createdByEmployeeId?: string; // who created the project, from CreateProjectModal — optional since older rows predate this
  // Only meaningful when type === 'SP' — which top-level "โครงการ (P)" this โครงการย่อย belongs
  // under. Server-validated (see projects.ts's resolveParentProjectId): the referenced project
  // must itself be type 'P', so a sub-project chain can never nest more than one level deep.
  parentProjectId?: string;
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
  priority?: ProjectPriority; // optional, from the "เพิ่มงาน" modal — same 1-5 scale as a project's own priority
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
  // Required whenever status is 'blocked' (see AddTaskModal's checkbox) — cleared server-side the
  // moment status moves away from 'blocked', so a stale reason never resurfaces on a later block.
  blockedReason?: string;
  // งานย่อย — set when this row is a subtask of another project_task. A subtask is otherwise a
  // full, ordinary ProjectTaskItem (own assignee/reviewer/status/submit-review flow, counted in
  // the project's overall progress exactly like a top-level task) and is exempt from the
  // ownership-gated edit/delete flow that top-level tasks go through (see server/routes/
  // project-tasks.ts) — anyone can edit/delete a subtask directly, no change_request involved.
  // Deleting the parent cascades to delete its subtasks (ON DELETE CASCADE at the DB level).
  parentTaskId?: string | null;
}
