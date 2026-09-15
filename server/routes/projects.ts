import { Router } from 'express';
import type { RowDataPacket } from 'mysql2';
import { pool } from '../db.ts';
import { nowBangkokDateTime, formatThaiDateShort } from '../lib/datetime.ts';
import { customStatusIds } from './project-custom-statuses.ts';

export const projectsRouter = Router();

const STATUSES = ['draft', 'pending_review', 'in_progress', 'on_hold', 'completed', 'cancelled', 'idea'];
const PRIORITIES = [1, 2, 3, 4, 5]; // numeric 1-5 scale, 1 = most important — same scale as project_task.priority
const PROJECT_TYPES = ['P', 'SP', 'I', 'C', 'B', 'FND'];

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
// restarts per {abbreviation, year, type} combination (scoped LIKE-prefix match + numeric MAX,
// same collision-safe technique the old global PRJ-NNN counter used). Falls back to the old flat
// scheme when abbreviation/type aren't supplied, so a project can still always get a valid code.
async function generateProjectCode(abbreviation: string, type: string | null): Promise<string> {
  // mysql2 returns a MAX(CAST(...AS UNSIGNED)) aggregate as a JS string (BIGINT precision
  // safety), not a number — `Number(maxNum)` actually converts it at runtime; the previous
  // `maxNum as number` was a compile-time-only assertion, so `+ 1` silently string-concatenated
  // instead of adding once any row existed (e.g. "1" + 1 -> "11" instead of 2), corrupting every
  // code after the first ("PRJ-001" -> "PRJ-011" -> "PRJ-111" -> ...).
  if (abbreviation && type) {
    const prefix = `${abbreviation}-${beYear2Digits()}-${type}-`;
    const [[{ maxNum }]] = await pool.query<RowDataPacket[]>(
      `SELECT COALESCE(MAX(CAST(SUBSTRING(code, ?) AS UNSIGNED)), 0) as maxNum FROM project WHERE code LIKE ?`,
      [prefix.length + 1, `${prefix}%`]
    );
    return `${prefix}${String(Number(maxNum) + 1).padStart(3, '0')}`;
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
  owner_employee_id: string | null;
  member_employee_ids: string | null;
  member_duties: string | null;
  doc_folder_id: string | null;
  progress: number | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  created_at: string;
}

// Same JSON-array-as-TEXT convention as employee.restricted_menu_ids — filters out anything that
// isn't a plain string id so a malformed body can't corrupt the stored list.
function sanitizeMemberIds(raw: unknown): string[] {
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

// daysUntilDue is deliberately never stored — it's "days from right now", so it has to be
// computed fresh on every read or it'd go stale the moment a day passes.
function daysUntilDue(endDate: string | null): number | undefined {
  if (!endDate) return undefined;
  const end = new Date(`${endDate}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
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
    ownerEmployeeId: r.owner_employee_id,
    memberEmployeeIds: r.member_employee_ids ? JSON.parse(r.member_employee_ids) : [],
    memberDuties: r.member_duties ? JSON.parse(r.member_duties) : undefined,
    docFolderId: r.doc_folder_id,
    progress: r.progress,
    startDate: formatThaiDateShort(r.start_date),
    endDate: formatThaiDateShort(r.end_date),
    startDateISO: r.start_date,
    endDateISO: r.end_date,
    createdDate: formatThaiDateShort(r.created_at ? r.created_at.slice(0, 10) : null),
    daysUntilDue: daysUntilDue(r.end_date),
    status: r.status,
  };
}

projectsRouter.get('/', async (_req, res) => {
  try {
    const [rows] = await pool.query<ProjectRowDb[]>(
      `SELECT id, code, title, description, department, type, abbreviation, priority, budget, owner_employee_id,
              member_employee_ids, member_duties, doc_folder_id, progress, start_date, end_date, status, created_at
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
  const status = (await isValidProjectStatus(p.status)) ? p.status : 'draft';
  const priority = PRIORITIES.includes(p.priority) ? p.priority : null;
  const type = PROJECT_TYPES.includes(p.type) ? p.type : null;
  const abbreviation = typeof p.abbreviation === 'string' ? p.abbreviation.trim().toUpperCase() : '';
  const memberEmployeeIds = sanitizeMemberIds(p.memberEmployeeIds);
  const memberDuties = sanitizeMemberDuties(p.memberDuties);

  try {
    const code = await generateProjectCode(abbreviation, type);
    const id = `PROJ_${Date.now()}`;
    const now = nowBangkokDateTime();

    await pool.query(
      `INSERT INTO project
         (id, code, title, description, department, type, abbreviation, priority, budget, owner_employee_id,
          member_employee_ids, member_duties, doc_folder_id, progress, start_date, end_date, status, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, code, p.title.trim(), p.description?.trim() || null, p.department || null, type, abbreviation || null, priority,
        p.budget ?? null, p.ownerEmployeeId || null, memberEmployeeIds.length ? JSON.stringify(memberEmployeeIds) : null,
        Object.keys(memberDuties).length ? JSON.stringify(memberDuties) : null,
        p.docFolderId || null, p.progress ?? 0, p.startDate || null, p.endDate || null, status, p.createdBy || null, now, now,
      ]
    );

    const [[row]] = await pool.query<ProjectRowDb[]>(
      `SELECT id, code, title, description, department, type, abbreviation, priority, budget, owner_employee_id,
              member_employee_ids, member_duties, doc_folder_id, progress, start_date, end_date, status, created_at
       FROM project WHERE id = ?`,
      [id]
    );
    res.status(201).json(toProjectRow(row));
  } catch (err) {
    console.error('POST /api/projects failed:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง' });
  }
});

// Partial update — only touches fields actually present in the body.
projectsRouter.put('/:id', async (req, res) => {
  const p = req.body ?? {};
  const fields: string[] = [];
  const values: unknown[] = [];

  if (typeof p.title === 'string' && p.title.trim()) { fields.push('title = ?'); values.push(p.title.trim()); }
  if ('description' in p) { fields.push('description = ?'); values.push(p.description?.trim() || null); }
  if ('department' in p) { fields.push('department = ?'); values.push(p.department || null); }
  // type/abbreviation are editable after creation (per spec), but the code itself — already
  // generated from whatever they were at creation time — is intentionally never regenerated, so
  // a project's code stays a stable identifier even if its type/abbreviation are corrected later.
  if ('type' in p) { fields.push('type = ?'); values.push(PROJECT_TYPES.includes(p.type) ? p.type : null); }
  if ('abbreviation' in p) { fields.push('abbreviation = ?'); values.push(typeof p.abbreviation === 'string' && p.abbreviation.trim() ? p.abbreviation.trim().toUpperCase() : null); }
  if ('priority' in p) { fields.push('priority = ?'); values.push(PRIORITIES.includes(p.priority) ? p.priority : null); }
  if ('budget' in p) { fields.push('budget = ?'); values.push(p.budget ?? null); }
  if ('ownerEmployeeId' in p) { fields.push('owner_employee_id = ?'); values.push(p.ownerEmployeeId || null); }
  if ('docFolderId' in p) { fields.push('doc_folder_id = ?'); values.push(p.docFolderId || null); }
  if ('memberEmployeeIds' in p) {
    const memberEmployeeIds = sanitizeMemberIds(p.memberEmployeeIds);
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

  if (fields.length === 0) {
    return res.status(400).json({ message: 'ไม่มีข้อมูลที่จะอัปเดต' });
  }

  try {
    fields.push('updated_at = ?');
    values.push(nowBangkokDateTime());
    await pool.query(`UPDATE project SET ${fields.join(', ')} WHERE id = ?`, [...values, req.params.id]);

    // Return the freshly-formatted row (not just {id}) so the client can replace its local copy
    // outright — updates may include raw ISO dates, which must never leak into the Thai-formatted
    // display fields the rest of the UI reads directly off ProjectRow.
    const [[row]] = await pool.query<ProjectRowDb[]>(
      `SELECT id, code, title, description, department, type, abbreviation, priority, budget, owner_employee_id,
              member_employee_ids, member_duties, doc_folder_id, progress, start_date, end_date, status, created_at
       FROM project WHERE id = ?`,
      [req.params.id]
    );
    res.json(toProjectRow(row));
  } catch (err) {
    console.error('PUT /api/projects/:id failed:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง' });
  }
});

projectsRouter.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM project WHERE id = ?', [req.params.id]);
    res.status(204).end();
  } catch (err) {
    console.error('DELETE /api/projects/:id failed:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง' });
  }
});
