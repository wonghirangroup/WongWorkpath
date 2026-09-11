import { Router } from 'express';
import type { RowDataPacket } from 'mysql2';
import { pool } from '../db.ts';
import { nowBangkokDateTime, formatThaiDateShort } from '../lib/datetime.ts';

export const projectsRouter = Router();

const STATUSES = ['draft', 'in_progress', 'on_hold', 'completed', 'cancelled'];
const PRIORITIES = ['High', 'Medium', 'Low'];

interface ProjectRowDb extends RowDataPacket {
  id: string;
  code: string;
  title: string;
  description: string | null;
  department: string | null;
  priority: string | null;
  budget: string | null; // DECIMAL comes back as a string from mysql2
  owner_employee_id: string | null;
  progress: number | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  created_at: string;
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
    priority: r.priority ?? undefined,
    budget: r.budget !== null ? Number(r.budget) : null,
    ownerEmployeeId: r.owner_employee_id,
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
      `SELECT id, code, title, description, department, priority, budget, owner_employee_id,
              progress, start_date, end_date, status, created_at
       FROM project ORDER BY created_at DESC`
    );
    res.json(rows.map(toProjectRow));
  } catch (err) {
    console.error('GET /api/projects failed:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง' });
  }
});

// Generates both the internal id and the human-facing "PRJ-NNN" code server-side — the client
// used to guess the next code from the length of its own local array, which only worked because
// nothing else could ever be creating a project at the same time.
projectsRouter.post('/', async (req, res) => {
  const p = req.body ?? {};
  if (!p.title || typeof p.title !== 'string' || !p.title.trim()) {
    return res.status(400).json({ message: 'กรุณาระบุชื่อโครงการ' });
  }
  const status = STATUSES.includes(p.status) ? p.status : 'draft';
  const priority = PRIORITIES.includes(p.priority) ? p.priority : null;

  try {
    const [[{ cnt }]] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) as cnt FROM project');
    const code = `PRJ-${String((cnt as number) + 1).padStart(3, '0')}`;
    const id = `PROJ_${Date.now()}`;
    const now = nowBangkokDateTime();

    await pool.query(
      `INSERT INTO project
         (id, code, title, description, department, priority, budget, owner_employee_id,
          progress, start_date, end_date, status, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, code, p.title.trim(), p.description?.trim() || null, p.department || null, priority,
        p.budget ?? null, p.ownerEmployeeId || null, p.progress ?? 0, p.startDate || null,
        p.endDate || null, status, p.createdBy || null, now, now,
      ]
    );

    const [[row]] = await pool.query<ProjectRowDb[]>(
      `SELECT id, code, title, description, department, priority, budget, owner_employee_id,
              progress, start_date, end_date, status, created_at
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
  if ('priority' in p) { fields.push('priority = ?'); values.push(PRIORITIES.includes(p.priority) ? p.priority : null); }
  if ('budget' in p) { fields.push('budget = ?'); values.push(p.budget ?? null); }
  if ('ownerEmployeeId' in p) { fields.push('owner_employee_id = ?'); values.push(p.ownerEmployeeId || null); }
  if (typeof p.progress === 'number') { fields.push('progress = ?'); values.push(p.progress); }
  if ('startDate' in p) { fields.push('start_date = ?'); values.push(p.startDate || null); }
  if ('endDate' in p) { fields.push('end_date = ?'); values.push(p.endDate || null); }
  if (typeof p.status === 'string' && STATUSES.includes(p.status)) { fields.push('status = ?'); values.push(p.status); }

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
      `SELECT id, code, title, description, department, priority, budget, owner_employee_id,
              progress, start_date, end_date, status, created_at
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
