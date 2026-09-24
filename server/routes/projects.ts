import { Router } from 'express';
import type { RowDataPacket } from 'mysql2';
import { pool, withTransaction } from '../db.ts';
import { nowBangkokDateTime, formatThaiDateShort, daysUntilBangkokDate } from '../lib/datetime.ts';
import { customStatusIds } from './project-custom-statuses.ts';
import { customTypeIds } from './project-custom-types.ts';
import { isOwner, isExecutiveActor, isProjectDeleterActor, resolveValidOwnerIds } from '../lib/ownership.ts';

export const projectsRouter = Router();

const STATUSES = ['draft', 'pending_review', 'in_progress', 'on_hold', 'completed', 'cancelled', 'idea'];
const PRIORITIES = [1, 2, 3, 4, 5]; // numeric 1-5 scale, 1 = most important — same scale as project_task.priority
const PROJECT_TYPES = ['P', 'SP', 'I', 'C', 'B', 'FND'];

// A project's type can also be a user-created custom type id (project_custom_type table, its
// abbreviation doubling as the id) — same "checked fresh, not cached" reasoning as
// isValidProjectStatus below.
async function isValidProjectType(type: unknown): Promise<boolean> {
  if (typeof type !== 'string') return false;
  if (PROJECT_TYPES.includes(type)) return true;
  return (await customTypeIds()).includes(type);
}

// A project's status can also be a user-created custom status id (project_custom_status table),
// not just one of the 7 built-ins above — checked against the DB fresh each call rather than
// cached, since custom statuses are rare/low-volume and this keeps a newly-created one usable
// immediately with zero cache-invalidation logic to get wrong.
async function isValidProjectStatus(status: unknown): Promise<boolean> {
  if (typeof status !== 'string') return false;
  if (STATUSES.includes(status)) return true;
  return (await customStatusIds()).includes(status);
}

// Buddhist-era year, last 2 digits — e.g. 2026 -> 2569 -> "69". Computed from the same
// Bangkok-wall-clock source as every other timestamp this API writes (see lib/datetime.ts),
// not the server host's own locale/timezone.
function beYear2Digits(): string {
  const gregorianYear = Number(nowBangkokDateTime().slice(0, 4));
  return String((gregorianYear + 543) % 100).padStart(2, '0');
}

// New format: {abbreviation}-{2-digit BE year}-{type}-{sequence}, e.g. "WP-69-P-001" — sequence
// runs per year only (not per type or abbreviation), so it reads as "the Nth project created this
// year" regardless of type/abbreviation — per product decision (2569-09-20), the number should
// just keep incrementing project to project, not restart at 001 every time a new project happens
// to be the first of its type. Matches on the "-{year}-" substring anywhere in the code and reads
// the trailing segment (the sequence itself) via SUBSTRING_INDEX(code, '-', -1), so it doesn't
// care how many hyphens the abbreviation itself contains. Falls back to the old flat scheme when
// abbreviation/type aren't supplied, so a project can still always get a valid code.
async function generateProjectCode(abbreviation: string, type: string | null): Promise<string> {
  // mysql2 returns a MAX(CAST(...AS UNSIGNED)) aggregate as a JS string (BIGINT precision
  // safety), not a number — `Number(maxNum)` actually converts it at runtime; the previous
  // `maxNum as number` was a compile-time-only assertion, so `+ 1` silently string-concatenated
  // instead of adding once any row existed (e.g. "1" + 1 -> "11" instead of 2), corrupting every
  // code after the first ("PRJ-001" -> "PRJ-011" -> "PRJ-111" -> ...).
  if (abbreviation && type) {
    const yy = beYear2Digits();
    const [[{ maxNum }]] = await pool.query<RowDataPacket[]>(
      `SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(code, '-', -1) AS UNSIGNED)), 0) as maxNum FROM project WHERE code LIKE ?`,
      [`%-${yy}-%`]
    );
    return `${abbreviation}-${yy}-${type}-${String(Number(maxNum) + 1).padStart(3, '0')}`;
  }
  const [[{ maxNum }]] = await pool.query<RowDataPacket[]>(
    `SELECT COALESCE(MAX(CAST(SUBSTRING(code, 5) AS UNSIGNED)), 0) as maxNum FROM project WHERE code LIKE 'PRJ-%'`
  );
  return `PRJ-${String(Number(maxNum) + 1).padStart(3, '0')}`;
}

interface ProjectRowDb extends RowDataPacket {
  id: string;
  code: string;
  title: string;
  description: string | null;
  department: string | null;
  type: string | null;
  abbreviation: string | null;
  priority: string | null; // VARCHAR column storing '1'-'5' — converted to a number in toProjectRow
  budget: string | null; // DECIMAL comes back as a string from mysql2
  owner_employee_ids: string | null;
  member_employee_ids: string | null;
  member_duties: string | null;
  doc_folder_id: string | null;
  progress: number | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  created_by: string | null;
  parent_project_id: string | null;
  created_at: string;
}

// Same JSON-array-as-TEXT convention as employee.restricted_menu_ids — filters out anything that
// isn't a plain string id so a malformed body can't corrupt the stored list. Shared by both
// owner_employee_ids and member_employee_ids, which are stored identically.
function sanitizeIds(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((id): id is string => typeof id === 'string') : [];
}

// Same convention, but a JSON object (employeeId -> duty text) rather than an array — filters
// out anything whose key/value isn't a plain string.
function sanitizeMemberDuties(raw: unknown): Record<string, string> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
  const result: Record<string, string> = {};
  for (const [id, duty] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof duty === 'string' && duty.trim()) result[id] = duty.trim();
  }
  return result;
}

// camelCase + Thai-formatted dates, matching the ProjectRow shape the client already renders
// (see projectBoard/types.ts) so ProjectTable/ProjectCard/ProjectDetail need no changes at all.
// startDateISO/endDateISO are the raw yyyy-mm-dd values alongside — the display fields are
// already Thai-formatted text and can't be fed back into an <input type="date"> for editing.
function toProjectRow(r: ProjectRowDb) {
  return {
    id: r.id,
    code: r.code,
    title: r.title,
    description: r.description ?? undefined,
    department: r.department ?? undefined,
    type: r.type ?? undefined,
    abbreviation: r.abbreviation ?? undefined,
    priority: r.priority !== null ? Number(r.priority) : undefined,
    budget: r.budget !== null ? Number(r.budget) : null,
    ownerEmployeeIds: r.owner_employee_ids ? JSON.parse(r.owner_employee_ids) : [],
    memberEmployeeIds: r.member_employee_ids ? JSON.parse(r.member_employee_ids) : [],
    memberDuties: r.member_duties ? JSON.parse(r.member_duties) : undefined,
    docFolderId: r.doc_folder_id,
    progress: r.progress,
    startDate: formatThaiDateShort(r.start_date),
    endDate: formatThaiDateShort(r.end_date),
    startDateISO: r.start_date,
    endDateISO: r.end_date,
    createdDate: formatThaiDateShort(r.created_at ? r.created_at.slice(0, 10) : null),
    // Never stored — it's "days from right now", so it's computed fresh on every read.
    daysUntilDue: daysUntilBangkokDate(r.end_date),
    status: r.status,
    createdByEmployeeId: r.created_by ?? undefined,
    parentProjectId: r.parent_project_id ?? undefined,
  };
}

// A parent is only meaningful for a "โครงการย่อย" (type SP) and must itself be a top-level
// "โครงการ" (type P) — never another sub-project, so a chain can never nest more than one level
// deep. Anything else (missing, wrong type, or the project pointing at itself) silently becomes
// no parent, same defensive fallback isValidProjectType/isValidProjectStatus already use for a
// bad value rather than hard-erroring the whole request over one field.
async function resolveParentProjectId(type: string | null, candidateId: unknown, ownId: string | null): Promise<string | null> {
  if (type !== 'SP' || typeof candidateId !== 'string' || !candidateId || candidateId === ownId) return null;
  const [[parent]] = await pool.query<RowDataPacket[]>('SELECT id FROM project WHERE id = ? AND type = ?', [candidateId, 'P']);
  return parent ? candidateId : null;
}

projectsRouter.get('/', async (_req, res) => {
  try {
    const [rows] = await pool.query<ProjectRowDb[]>(
      `SELECT id, code, title, description, department, type, abbreviation, priority, budget, owner_employee_ids,
              member_employee_ids, member_duties, doc_folder_id, progress, start_date, end_date, status, created_by, parent_project_id, created_at
       FROM project ORDER BY created_at DESC`
    );
    res.json(rows.map(toProjectRow));
  } catch (err) {
    console.error('GET /api/projects failed:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง' });
  }
});

// Generates both the internal id and the human-facing code server-side (see generateProjectCode)
// — the client used to guess the next code from the length of its own local array, which only
// worked because nothing else could ever be creating a project at the same time.
projectsRouter.post('/', async (req, res) => {
  const p = req.body ?? {};
  if (!p.title || typeof p.title !== 'string' || !p.title.trim()) {
    return res.status(400).json({ message: 'กรุณาระบุชื่อโครงการ' });
  }
  const priority = PRIORITIES.includes(p.priority) ? p.priority : null;
  const abbreviation = typeof p.abbreviation === 'string' ? p.abbreviation.trim().toUpperCase() : '';
  const ownerEmployeeIds = sanitizeIds(p.ownerEmployeeIds);
  const memberEmployeeIds = sanitizeIds(p.memberEmployeeIds);
  const memberDuties = sanitizeMemberDuties(p.memberDuties);

  try {
    const status = (await isValidProjectStatus(p.status)) ? p.status : 'draft';
    const type = (await isValidProjectType(p.type)) ? p.type : null;
    const code = await generateProjectCode(abbreviation, type);
    // Normally server-generated, but CreateProjectModal's own "create matching Drive folder"
    // checkbox needs the project's real id before the project itself exists (so the new folder's
    // document row can be tagged scope='โครงการ' + this projectId right away, instead of briefly
    // existing untagged) — it pre-generates and sends one in that case.
    const id = typeof p.id === 'string' && p.id ? p.id : `PROJ_${Date.now()}`;
    const parentProjectId = await resolveParentProjectId(type, p.parentProjectId, id);
    const now = nowBangkokDateTime();

    await pool.query(
      `INSERT INTO project
         (id, code, title, description, department, type, abbreviation, priority, budget, owner_employee_ids,
          member_employee_ids, member_duties, doc_folder_id, progress, start_date, end_date, status, created_by, parent_project_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, code, p.title.trim(), p.description?.trim() || null, p.department || null, type, abbreviation || null, priority,
        p.budget ?? null, ownerEmployeeIds.length ? JSON.stringify(ownerEmployeeIds) : null, memberEmployeeIds.length ? JSON.stringify(memberEmployeeIds) : null,
        Object.keys(memberDuties).length ? JSON.stringify(memberDuties) : null,
        p.docFolderId || null, p.progress ?? 0, p.startDate || null, p.endDate || null, status, req.actorId, parentProjectId, now, now,
      ]
    );

    const [[row]] = await pool.query<ProjectRowDb[]>(
      `SELECT id, code, title, description, department, type, abbreviation, priority, budget, owner_employee_ids,
              member_employee_ids, member_duties, doc_folder_id, progress, start_date, end_date, status, created_by, parent_project_id, created_at
       FROM project WHERE id = ?`,
      [id]
    );
    res.status(201).json(toProjectRow(row));
  } catch (err) {
    console.error('POST /api/projects failed:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง' });
  }
});

// Shared by the public PUT route and change-requests.ts's approve-an-edit-request path, so the
// exact same field-mapping logic applies a change whether it went through the instant path or the
// approval path — only whichever CALLER is trusted differs (the public route re-checks ownership
// each time; change-requests.ts applies straight through since a request only ever exists because
// the ownership check already sent it there instead of here).
export async function applyProjectFields(id: string, p: any) {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (typeof p.title === 'string' && p.title.trim()) { fields.push('title = ?'); values.push(p.title.trim()); }
  if ('description' in p) { fields.push('description = ?'); values.push((p.description as string | undefined)?.trim() || null); }
  if ('department' in p) { fields.push('department = ?'); values.push(p.department || null); }
  // type/abbreviation are editable after creation (per spec), but the code itself — already
  // generated from whatever they were at creation time — is intentionally never regenerated, so
  // a project's code stays a stable identifier even if its type/abbreviation are corrected later.
  if ('type' in p) { fields.push('type = ?'); values.push((await isValidProjectType(p.type)) ? p.type : null); }
  if ('abbreviation' in p) { fields.push('abbreviation = ?'); values.push(typeof p.abbreviation === 'string' && p.abbreviation.trim() ? p.abbreviation.trim().toUpperCase() : null); }
  if ('priority' in p) { fields.push('priority = ?'); values.push(PRIORITIES.includes(p.priority) ? p.priority : null); }
  if ('budget' in p) { fields.push('budget = ?'); values.push(p.budget ?? null); }
  if ('ownerEmployeeIds' in p) {
    const ownerEmployeeIds = sanitizeIds(p.ownerEmployeeIds);
    fields.push('owner_employee_ids = ?');
    values.push(ownerEmployeeIds.length ? JSON.stringify(ownerEmployeeIds) : null);
  }
  if ('docFolderId' in p) { fields.push('doc_folder_id = ?'); values.push(p.docFolderId || null); }
  if ('memberEmployeeIds' in p) {
    const memberEmployeeIds = sanitizeIds(p.memberEmployeeIds);
    fields.push('member_employee_ids = ?');
    values.push(memberEmployeeIds.length ? JSON.stringify(memberEmployeeIds) : null);
  }
  if ('memberDuties' in p) {
    const memberDuties = sanitizeMemberDuties(p.memberDuties);
    fields.push('member_duties = ?');
    values.push(Object.keys(memberDuties).length ? JSON.stringify(memberDuties) : null);
  }
  if (typeof p.progress === 'number') { fields.push('progress = ?'); values.push(p.progress); }
  if ('startDate' in p) { fields.push('start_date = ?'); values.push(p.startDate || null); }
  if ('endDate' in p) { fields.push('end_date = ?'); values.push(p.endDate || null); }
  if (typeof p.status === 'string' && (await isValidProjectStatus(p.status))) { fields.push('status = ?'); values.push(p.status); }
  if ('parentProjectId' in p) {
    // Needs the project's own effective type to validate against — either what THIS same request
    // is also setting `type` to, or (if `type` isn't part of this update) whatever it's already
    // stored as.
    let effectiveType: string | null;
    if ('type' in p) {
      effectiveType = (await isValidProjectType(p.type)) ? p.type : null;
    } else {
      const [[current]] = await pool.query<RowDataPacket[]>('SELECT type FROM project WHERE id = ?', [id]);
      effectiveType = current?.type ?? null;
    }
    fields.push('parent_project_id = ?');
    values.push(await resolveParentProjectId(effectiveType, p.parentProjectId, id));
  }

  if (fields.length === 0) return null;

  fields.push('updated_at = ?');
  values.push(nowBangkokDateTime());
  await pool.query(`UPDATE project SET ${fields.join(', ')} WHERE id = ?`, [...values, id]);

  const [[row]] = await pool.query<ProjectRowDb[]>(
    `SELECT id, code, title, description, department, type, abbreviation, priority, budget, owner_employee_ids,
            member_employee_ids, member_duties, doc_folder_id, progress, start_date, end_date, status, created_by, parent_project_id, created_at
     FROM project WHERE id = ?`,
    [id]
  );
  return row ? toProjectRow(row) : null;
}

// Partial update — only touches fields actually present in the body.
projectsRouter.put('/:id', async (req, res) => {
  const p = req.body ?? {};

  try {
    // Once a project has ≥1 owner, only one of them may edit it directly — anyone else must file a
    // change_request instead (see change-requests.ts). An unowned project stays open to everyone,
    // same as before this feature existed.
    const [[existing]] = await pool.query<RowDataPacket[]>('SELECT owner_employee_ids FROM project WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ message: 'ไม่พบโครงการนี้' });
    const currentOwnerIds: string[] = existing.owner_employee_ids ? JSON.parse(existing.owner_employee_ids) : [];
    const validOwnerIds = await resolveValidOwnerIds(currentOwnerIds);
    if (!isOwner(validOwnerIds, p.actorEmployeeId) && !(await isExecutiveActor(p.actorEmployeeId))) {
      return res.status(409).json({ message: 'ต้องขออนุมัติจากผู้รับผิดชอบหลักก่อนจึงจะแก้ไขได้', requiresApproval: true });
    }

    const row = await applyProjectFields(req.params.id, p);
    if (!row) return res.status(400).json({ message: 'ไม่มีข้อมูลที่จะอัปเดต' });
    // Returns the freshly-formatted row (not just {id}) so the client can replace its local copy
    // outright — updates may include raw ISO dates, which must never leak into the Thai-formatted
    // display fields the rest of the UI reads directly off ProjectRow.
    res.json(row);
  } catch (err) {
    console.error('PUT /api/projects/:id failed:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง' });
  }
});

// Deleting a project takes its tasks with it (FK cascade), and now also everything else that only
// makes sense inside it: its Drive files/folders and any pending change requests. Vault secrets
// filed under the project are never destroyed — they move back to their creator's personal vault,
// so nobody loses a password just because a project ended.
export async function deleteProjectCascade(projectId: string): Promise<void> {
  await withTransaction(async (conn) => {
    await conn.query(
      `DELETE FROM change_request
       WHERE (entity_type = 'project' AND entity_id = ?)
          OR (entity_type = 'project_task' AND entity_id IN (SELECT id FROM project_task WHERE project_id = ?))`,
      [projectId, projectId]
    );
    await conn.query(
      `DELETE FROM deadline_reminder
       WHERE (entity_type = 'project' AND entity_id = ?)
          OR (entity_type = 'task' AND entity_id IN (SELECT id FROM project_task WHERE project_id = ?))`,
      [projectId, projectId]
    );
    await conn.query('DELETE FROM document WHERE project_id = ?', [projectId]);
    await conn.query(
      `UPDATE credential SET scope = 'ส่วนตัว', project_id = NULL, team = NULL, updated_at = ? WHERE scope = 'โครงการ' AND project_id = ?`,
      [nowBangkokDateTime(), projectId]
    );
    await conn.query('DELETE FROM project WHERE id = ?', [projectId]);
  });
}

projectsRouter.delete('/:id', async (req, res) => {
  try {
    const deleteActorId = req.actorId;
    // Role first: only admin / Super Admin / ผู้บริหาร may delete a project at all (the UI offers the
    // button to nobody else). Ownership then decides whether it happens right away or needs approval.
    if (!(await isProjectDeleterActor(deleteActorId))) {
      return res.status(403).json({ message: 'ไม่มีสิทธิ์ลบโครงการ (เฉพาะ Admin / Super Admin / ผู้บริหาร)' });
    }
    const [[existing]] = await pool.query<RowDataPacket[]>('SELECT owner_employee_ids FROM project WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ message: 'ไม่พบโครงการนี้' });
    const currentOwnerIds: string[] = existing.owner_employee_ids ? JSON.parse(existing.owner_employee_ids) : [];
    const validOwnerIds = await resolveValidOwnerIds(currentOwnerIds);
    if (!isOwner(validOwnerIds, deleteActorId) && !(await isExecutiveActor(deleteActorId))) {
      return res.status(409).json({ message: 'ต้องขออนุมัติจากผู้รับผิดชอบหลักก่อนจึงจะลบได้', requiresApproval: true });
    }

    await deleteProjectCascade(req.params.id);
    res.status(204).end();
  } catch (err) {
    console.error('DELETE /api/projects/:id failed:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง' });
  }
});
