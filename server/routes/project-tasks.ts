import { Router } from 'express';
import type { RowDataPacket } from 'mysql2';
import { pool } from '../db.ts';
import { nowBangkokDateTime, formatThaiDateShort } from '../lib/datetime.ts';
import { isOwner, isExecutiveActor, resolveValidOwnerIds } from '../lib/ownership.ts';

export const projectTasksRouter = Router();

const STATUSES = ['todo', 'in_progress', 'review', 'blocked', 'done'];
const PRIORITIES = [1, 2, 3, 4, 5]; // numeric 1-5 scale, 1 = most important — same scale as project.priority

interface ProjectTaskRowDb extends RowDataPacket {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string | null; // VARCHAR column storing '1'-'5' — converted to a number in toProjectTask
  assignee_employee_ids: string | null;
  reviewer_employee_ids: string | null;
  creator_employee_id: string | null;
  start_date: string | null;
  due_date: string | null;
  progress: number;
  checklist: string | null;
  submission_note: string | null;
  submission_file_ids: string | null;
  review_note: string | null;
  blocked_reason: string | null;
  parent_task_id: string | null;
}

// Same JSON-array-as-TEXT convention as project.member_employee_ids.
function sanitizeChecklist(raw: unknown): { label: string; done: boolean }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is { label: unknown; done: unknown } => typeof item === 'object' && item !== null)
    .map((item) => ({ label: typeof item.label === 'string' ? item.label : '', done: Boolean(item.done) }));
}

// Same JSON-array-as-TEXT convention, for the Doc Vault file ids attached at submission time, and
// for assignee/reviewer employee ids (a task can have more than one of either).
function sanitizeIds(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((id): id is string => typeof id === 'string') : [];
}

function daysUntilDue(dueDate: string | null): number | undefined {
  if (!dueDate) return undefined;
  const due = new Date(`${dueDate}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

// startDateISO/dueDateISO mirror ProjectRow's own startDateISO/endDateISO pattern — the display
// fields (startDate/dueDate) stay pre-formatted Thai text so ProjectDetail's tables/team tab need
// no changes, while the *ISO fields let AddTaskModal's edit mode populate <input type="date">.
function toProjectTask(r: ProjectTaskRowDb) {
  return {
    id: r.id,
    projectId: r.project_id,
    title: r.title,
    description: r.description ?? undefined,
    status: r.status,
    priority: r.priority !== null ? Number(r.priority) : undefined,
    assigneeEmployeeIds: r.assignee_employee_ids ? JSON.parse(r.assignee_employee_ids) : [],
    reviewerEmployeeIds: r.reviewer_employee_ids ? JSON.parse(r.reviewer_employee_ids) : [],
    creatorEmployeeId: r.creator_employee_id ?? undefined,
    startDate: formatThaiDateShort(r.start_date),
    dueDate: formatThaiDateShort(r.due_date),
    startDateISO: r.start_date,
    dueDateISO: r.due_date,
    daysUntilDue: daysUntilDue(r.due_date),
    progress: r.progress,
    checklist: r.checklist ? JSON.parse(r.checklist) : [],
    submissionNote: r.submission_note ?? undefined,
    submissionFileIds: r.submission_file_ids ? JSON.parse(r.submission_file_ids) : [],
    reviewNote: r.review_note ?? undefined,
    blockedReason: r.blocked_reason ?? undefined,
    parentTaskId: r.parent_task_id ?? undefined,
  };
}

const SELECT_FIELDS = `id, project_id, title, description, status, priority, assignee_employee_ids, reviewer_employee_ids, creator_employee_id, start_date, due_date, progress, checklist, submission_note, submission_file_ids, review_note, blocked_reason, parent_task_id`;

// A task ("หัวข้อ" is just this same task type, created through a differently-labeled tab — see
// AddTaskModal.tsx) with 1+ subtasks has its own status fully derived from them, never manually
// set: 'in_progress' the moment it has any subtask that isn't 'done' — including the instant it
// gains its very first one — and 'done' only once every one of its subtasks is. Called after any
// create/update/delete that could change what a parent's children look like; walks upward through
// as many levels of nesting as exist (a topic's own parent could itself be someone else's subtask),
// stopping the moment a level's derived status doesn't actually need to change, since its own
// parent's status only depends on whether ITS children just changed.
async function recomputeAncestorStatuses(startParentId: string): Promise<void> {
  let pid: string | null = startParentId;
  while (pid) {
    const [children] = await pool.query<RowDataPacket[]>('SELECT status FROM project_task WHERE parent_task_id = ?', [pid]);
    if (children.length === 0) break; // no subtasks (any longer) — leave its status exactly as it already is, freely editable again
    const allDone = children.every((c) => c.status === 'done');
    const nextStatus = allDone ? 'done' : 'in_progress';
    const [[parentRow]] = await pool.query<RowDataPacket[]>('SELECT status, parent_task_id FROM project_task WHERE id = ?', [pid]);
    if (!parentRow || parentRow.status === nextStatus) break;
    await pool.query('UPDATE project_task SET status = ?, updated_at = ? WHERE id = ?', [nextStatus, nowBangkokDateTime(), pid]);
    pid = parentRow.parent_task_id;
  }
}

projectTasksRouter.get('/', async (_req, res) => {
  try {
    const [rows] = await pool.query<ProjectTaskRowDb[]>(
      `SELECT ${SELECT_FIELDS} FROM project_task ORDER BY created_at DESC`
    );
    res.json(rows.map(toProjectTask));
  } catch (err) {
    console.error('GET /api/project-tasks failed:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง' });
  }
});

projectTasksRouter.post('/', async (req, res) => {
  const t = req.body ?? {};
  if (!t.title || typeof t.title !== 'string' || !t.title.trim()) {
    return res.status(400).json({ message: 'กรุณาระบุชื่องาน' });
  }
  if (!t.projectId || typeof t.projectId !== 'string') {
    return res.status(400).json({ message: 'ไม่พบโครงการของงานนี้' });
  }
  const status = STATUSES.includes(t.status) ? t.status : 'todo';
  const priority = PRIORITIES.includes(t.priority) ? t.priority : null;
  const checklist = sanitizeChecklist(t.checklist);
  const assigneeIds = sanitizeIds(t.assigneeEmployeeIds);
  const reviewerIds = sanitizeIds(t.reviewerEmployeeIds);
  const parentTaskId = typeof t.parentTaskId === 'string' && t.parentTaskId ? t.parentTaskId : null;

  try {
    const id = `PTASK_${Date.now()}`;
    const now = nowBangkokDateTime();
    await pool.query(
      `INSERT INTO project_task
         (id, project_id, title, description, status, priority, assignee_employee_ids, reviewer_employee_ids,
          creator_employee_id, start_date, due_date, progress, checklist, parent_task_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, t.projectId, t.title.trim(), t.description?.trim() || null, status, priority,
        assigneeIds.length ? JSON.stringify(assigneeIds) : null, reviewerIds.length ? JSON.stringify(reviewerIds) : null,
        t.creatorEmployeeId || null, t.startDate || null, t.dueDate || null, t.progress ?? 0,
        checklist.length ? JSON.stringify(checklist) : null, parentTaskId, now, now,
      ]
    );

    // A project sitting at 'draft' clearly isn't a draft anymore once real work exists under
    // it — auto-promote it the moment its first task/subtask is created. Done here (not via the
    // public PUT /api/projects/:id) so it's never blocked by that route's ownership gate: whoever
    // just created this task might not be one of the project's owners, and this is a system-
    // triggered side effect of an already-unrestricted action (creating a task), not a user edit.
    await pool.query(`UPDATE project SET status = 'in_progress', updated_at = ? WHERE id = ? AND status = 'draft'`, [now, t.projectId]);

    // A brand-new subtask makes its parent "have subtasks" for the first time (or just adds one
    // more) — recompute right away rather than waiting for some later edit to notice.
    if (parentTaskId) await recomputeAncestorStatuses(parentTaskId);

    const [[row]] = await pool.query<ProjectTaskRowDb[]>(`SELECT ${SELECT_FIELDS} FROM project_task WHERE id = ?`, [id]);
    res.status(201).json(toProjectTask(row));
  } catch (err) {
    console.error('POST /api/project-tasks failed:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง' });
  }
});

// Shared by the public PUT route and change-requests.ts's approve-an-edit-request path — see the
// identical rationale on projects.ts's applyProjectFields.
export async function applyTaskFields(id: string, t: any) {
  const fields: string[] = [];
  const values: unknown[] = [];

  // A task with 1+ subtasks has a fully derived status (see recomputeAncestorStatuses) — a manual
  // status field on it is silently ignored rather than rejected, same "just don't touch that
  // column" treatment every other absent/inapplicable field here already gets.
  const [[childCountRow]] = await pool.query<RowDataPacket[]>(
    'SELECT COUNT(*) AS cnt FROM project_task WHERE parent_task_id = ?', [id]
  );
  const hasSubtasks = Number(childCountRow?.cnt ?? 0) > 0;

  if (typeof t.title === 'string' && t.title.trim()) { fields.push('title = ?'); values.push(t.title.trim()); }
  if ('description' in t) { fields.push('description = ?'); values.push((t.description as string | undefined)?.trim() || null); }
  if (!hasSubtasks && typeof t.status === 'string' && STATUSES.includes(t.status)) {
    fields.push('status = ?');
    values.push(t.status);
    // A reason only makes sense while the task is actually blocked — clear any stale one the
    // moment the status moves anywhere else, so an old blocker never resurfaces on a later block.
    if (t.status !== 'blocked' && !('blockedReason' in t)) { fields.push('blocked_reason = ?'); values.push(null); }
  }
  if ('priority' in t) { fields.push('priority = ?'); values.push(PRIORITIES.includes(t.priority) ? t.priority : null); }
  if ('assigneeEmployeeIds' in t) {
    const assigneeIds = sanitizeIds(t.assigneeEmployeeIds);
    fields.push('assignee_employee_ids = ?');
    values.push(assigneeIds.length ? JSON.stringify(assigneeIds) : null);
  }
  if ('reviewerEmployeeIds' in t) {
    const reviewerIds = sanitizeIds(t.reviewerEmployeeIds);
    fields.push('reviewer_employee_ids = ?');
    values.push(reviewerIds.length ? JSON.stringify(reviewerIds) : null);
  }
  if ('startDate' in t) { fields.push('start_date = ?'); values.push(t.startDate || null); }
  if ('dueDate' in t) { fields.push('due_date = ?'); values.push(t.dueDate || null); }
  if (typeof t.progress === 'number') { fields.push('progress = ?'); values.push(t.progress); }
  if ('checklist' in t) {
    const checklist = sanitizeChecklist(t.checklist);
    fields.push('checklist = ?');
    values.push(checklist.length ? JSON.stringify(checklist) : null);
  }
  // submissionNote/submissionFileIds are written together by the "ส่งงาน" flow; reviewNote by the
  // "ตรวจงาน" flow (pass clears it, reject sets it) — see MyWorkspace.tsx's two modals.
  if ('submissionNote' in t) { fields.push('submission_note = ?'); values.push((t.submissionNote as string | undefined)?.trim() || null); }
  if ('submissionFileIds' in t) {
    const fileIds = sanitizeIds(t.submissionFileIds);
    fields.push('submission_file_ids = ?');
    values.push(fileIds.length ? JSON.stringify(fileIds) : null);
  }
  if ('reviewNote' in t) { fields.push('review_note = ?'); values.push((t.reviewNote as string | undefined)?.trim() || null); }
  if ('blockedReason' in t) { fields.push('blocked_reason = ?'); values.push((t.blockedReason as string | undefined)?.trim() || null); }

  if (fields.length === 0) return null;

  fields.push('updated_at = ?');
  values.push(nowBangkokDateTime());
  await pool.query(`UPDATE project_task SET ${fields.join(', ')} WHERE id = ?`, [...values, id]);

  const [[row]] = await pool.query<ProjectTaskRowDb[]>(`SELECT ${SELECT_FIELDS} FROM project_task WHERE id = ?`, [id]);

  // This task's own status may have just changed — recompute every ancestor up the chain now
  // that one of a parent's children may look different. A no-op (single lookup) when this task
  // has no parent, or when hasSubtasks above already meant status couldn't have changed anyway.
  if (row?.parent_task_id) await recomputeAncestorStatuses(row.parent_task_id);

  return row ? toProjectTask(row) : null;
}

projectTasksRouter.put('/:id', async (req, res) => {
  const t = req.body ?? {};

  // Once a task has ≥1 assignee, only one of them (or one of its reviewers — ReviewTaskModal's
  // "ผ่าน"/"ตีกลับ" go through this same route) may edit it directly — anyone else must file a
  // change_request instead (see change-requests.ts). A task with no assignees yet stays open to
  // everyone. Reviewers are trusted with this same edit right, not just a narrower "decide"
  // action, since this app has no real per-field permission model to split the two.
  // งานย่อย (a row with parent_task_id set) is exempt from this gate entirely — per the product
  // decision, only the main task goes through approval, so anyone can edit a subtask directly.
  const [[existing]] = await pool.query<RowDataPacket[]>('SELECT assignee_employee_ids, reviewer_employee_ids, parent_task_id FROM project_task WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ message: 'ไม่พบงานนี้' });
  const currentAssigneeIds: string[] = existing.assignee_employee_ids ? JSON.parse(existing.assignee_employee_ids) : [];
  const currentReviewerIds: string[] = existing.reviewer_employee_ids ? JSON.parse(existing.reviewer_employee_ids) : [];
  const validOwnerIds = await resolveValidOwnerIds([...currentAssigneeIds, ...currentReviewerIds]);
  if (!existing.parent_task_id && !isOwner(validOwnerIds, t.actorEmployeeId) && !(await isExecutiveActor(t.actorEmployeeId))) {
    return res.status(409).json({ message: 'ต้องขออนุมัติจากผู้รับผิดชอบก่อนจึงจะแก้ไขได้', requiresApproval: true });
  }

  try {
    const row = await applyTaskFields(req.params.id, t);
    if (!row) return res.status(400).json({ message: 'ไม่มีข้อมูลที่จะอัปเดต' });
    res.json(row);
  } catch (err) {
    console.error('PUT /api/project-tasks/:id failed:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง' });
  }
});

projectTasksRouter.delete('/:id', async (req, res) => {
  try {
    const [[existing]] = await pool.query<RowDataPacket[]>('SELECT assignee_employee_ids, parent_task_id FROM project_task WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ message: 'ไม่พบงานนี้' });
    const currentAssigneeIds: string[] = existing.assignee_employee_ids ? JSON.parse(existing.assignee_employee_ids) : [];
    const validAssigneeIds = await resolveValidOwnerIds(currentAssigneeIds);
    // งานย่อยลบตรงได้เลย ไม่ต้องขออนุมัติ (เหมือนกฎฝั่งแก้ไขด้านบน)
    const deleteActorId = typeof req.query.actorEmployeeId === 'string' ? req.query.actorEmployeeId : undefined;
    if (!existing.parent_task_id && !isOwner(validAssigneeIds, deleteActorId) && !(await isExecutiveActor(deleteActorId))) {
      return res.status(409).json({ message: 'ต้องขออนุมัติจากผู้รับผิดชอบก่อนจึงจะลบได้', requiresApproval: true });
    }

    await pool.query('DELETE FROM project_task WHERE id = ?', [req.params.id]);
    // A deleted subtask may have been the deciding one keeping its parent 'in_progress' (or the
    // last one at all, in which case the parent's status simply falls back to being freely
    // editable again — see recomputeAncestorStatuses' own early-out for zero remaining children).
    if (existing.parent_task_id) await recomputeAncestorStatuses(existing.parent_task_id);
    res.status(204).end();
  } catch (err) {
    console.error('DELETE /api/project-tasks/:id failed:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง' });
  }
});
