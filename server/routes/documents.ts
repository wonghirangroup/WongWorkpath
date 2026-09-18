import { Router } from 'express';
import type { RowDataPacket } from 'mysql2';
import { pool } from '../db.ts';
import { nowBangkokDateTime } from '../lib/datetime.ts';
import { isExecutiveActor } from '../lib/ownership.ts';

export const documentsRouter = Router();

interface DocumentRowDb extends RowDataPacket {
  id: string;
  name: string;
  kind: 'folder' | 'file' | 'link';
  parent_id: string | null;
  url: string | null;
  file_data_url: string | null;
  file_mime_type: string | null;
  file_size: number | null;
  scope: 'ส่วนตัว' | 'โครงการ';
  project_id: string | null;
  task_id: string | null;
  creator_employee_id: string | null;
  version: number;
  last_updated: string;
  updated_by: string;
  history: string | null;
}

function toLinkedDoc(r: DocumentRowDb) {
  return {
    id: r.id,
    name: r.name,
    kind: r.kind,
    parentId: r.parent_id,
    url: r.url ?? undefined,
    fileDataUrl: r.file_data_url ?? undefined,
    fileMimeType: r.file_mime_type ?? undefined,
    fileSize: r.file_size ?? undefined,
    scope: r.scope,
    projectId: r.project_id ?? undefined,
    taskId: r.task_id ?? undefined,
    creatorEmployeeId: r.creator_employee_id ?? undefined,
    version: r.version,
    lastUpdated: r.last_updated,
    updatedBy: r.updated_by,
    history: r.history ? JSON.parse(r.history) : [],
  };
}

const SELECT_FIELDS = `id, name, kind, parent_id, url, file_data_url, file_mime_type, file_size, scope, project_id, task_id, creator_employee_id, version, last_updated, updated_by, history`;

// A doc scoped 'ส่วนตัว' is visible only to whoever created it — never shared, regardless of
// project involvement. A doc scoped 'โครงการ' is visible only to people "รับผิดชอบ" that specific
// project, meaning its current owners (ผู้รับผิดชอบหลัก) or members (ผู้รับผิดชอบร่วม) — matches the
// same vocabulary the rest of the app already uses for "who's on this project."
documentsRouter.get('/', async (req, res) => {
  const actorEmployeeId = typeof req.query.actorEmployeeId === 'string' ? req.query.actorEmployeeId : undefined;
  if (!actorEmployeeId) return res.json([]);

  try {
    const [rows] = await pool.query<DocumentRowDb[]>(`SELECT ${SELECT_FIELDS} FROM document ORDER BY created_at ASC`);
    // ผู้บริหาร sees every project's docs regardless of membership — still only their own
    // personal-scope docs, same as everyone else (see toLinkedDoc's scope split below).
    const isExecutive = await isExecutiveActor(actorEmployeeId);
    const [projectRows] = await pool.query<RowDataPacket[]>('SELECT id, owner_employee_ids, member_employee_ids FROM project');
    const myProjectIds = new Set(
      projectRows
        .filter((p) => {
          const owners: string[] = p.owner_employee_ids ? JSON.parse(p.owner_employee_ids) : [];
          const members: string[] = p.member_employee_ids ? JSON.parse(p.member_employee_ids) : [];
          return owners.includes(actorEmployeeId) || members.includes(actorEmployeeId);
        })
        .map((p) => p.id)
    );

    const visible = rows.filter((r) =>
      r.scope === 'ส่วนตัว' ? r.creator_employee_id === actorEmployeeId : Boolean(r.project_id && (isExecutive || myProjectIds.has(r.project_id)))
    );
    res.json(visible.map(toLinkedDoc));
  } catch (err) {
    console.error('GET /api/documents failed:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง' });
  }
});

documentsRouter.post('/', async (req, res) => {
  const d = req.body ?? {};
  if (!d.name || typeof d.name !== 'string' || !d.name.trim()) {
    return res.status(400).json({ message: 'กรุณาระบุชื่อ' });
  }
  if (!['folder', 'file', 'link'].includes(d.kind)) {
    return res.status(400).json({ message: 'ประเภทเอกสารไม่ถูกต้อง' });
  }
  const scope = d.scope === 'โครงการ' ? 'โครงการ' : 'ส่วนตัว';
  const projectId = scope === 'โครงการ' && typeof d.projectId === 'string' && d.projectId ? d.projectId : null;

  try {
    const id = `DOC_${Date.now()}`;
    const now = nowBangkokDateTime();
    await pool.query(
      `INSERT INTO document
         (id, name, kind, parent_id, url, file_data_url, file_mime_type, file_size, scope, project_id,
          task_id, creator_employee_id, version, last_updated, updated_by, history, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, d.name.trim(), d.kind, d.parentId || null, d.url || null, d.fileDataUrl || null,
        d.fileMimeType || null, d.fileSize ?? null, scope, projectId, d.taskId || null,
        d.creatorEmployeeId || null, d.version ?? 1, d.lastUpdated || now, d.updatedBy || '',
        Array.isArray(d.history) ? JSON.stringify(d.history) : null, now, now,
      ]
    );

    const [[row]] = await pool.query<DocumentRowDb[]>(`SELECT ${SELECT_FIELDS} FROM document WHERE id = ?`, [id]);
    res.status(201).json(toLinkedDoc(row));
  } catch (err) {
    console.error('POST /api/documents failed:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง' });
  }
});

documentsRouter.put('/:id', async (req, res) => {
  const d = req.body ?? {};
  const fields: string[] = [];
  const values: unknown[] = [];

  if (typeof d.name === 'string' && d.name.trim()) { fields.push('name = ?'); values.push(d.name.trim()); }
  if ('url' in d) { fields.push('url = ?'); values.push(d.url || null); }
  if ('parentId' in d) { fields.push('parent_id = ?'); values.push(d.parentId || null); }
  if (typeof d.scope === 'string') {
    const scope = d.scope === 'โครงการ' ? 'โครงการ' : 'ส่วนตัว';
    fields.push('scope = ?');
    values.push(scope);
    fields.push('project_id = ?');
    values.push(scope === 'โครงการ' && typeof d.projectId === 'string' && d.projectId ? d.projectId : null);
  }
  if (typeof d.version === 'number') { fields.push('version = ?'); values.push(d.version); }
  if (typeof d.lastUpdated === 'string') { fields.push('last_updated = ?'); values.push(d.lastUpdated); }
  if (typeof d.updatedBy === 'string') { fields.push('updated_by = ?'); values.push(d.updatedBy); }
  if (Array.isArray(d.history)) { fields.push('history = ?'); values.push(JSON.stringify(d.history)); }

  if (fields.length === 0) return res.status(400).json({ message: 'ไม่มีข้อมูลที่จะอัปเดต' });

  try {
    fields.push('updated_at = ?');
    values.push(nowBangkokDateTime());
    await pool.query(`UPDATE document SET ${fields.join(', ')} WHERE id = ?`, [...values, req.params.id]);

    const [[row]] = await pool.query<DocumentRowDb[]>(`SELECT ${SELECT_FIELDS} FROM document WHERE id = ?`, [req.params.id]);
    if (!row) return res.status(404).json({ message: 'ไม่พบเอกสารนี้' });
    res.json(toLinkedDoc(row));
  } catch (err) {
    console.error('PUT /api/documents/:id failed:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง' });
  }
});

// A folder's children cascade-delete automatically (FK parent_id ON DELETE CASCADE) — no
// breadth-first walk needed client-side like the old localStorage version required.
documentsRouter.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM document WHERE id = ?', [req.params.id]);
    res.status(204).end();
  } catch (err) {
    console.error('DELETE /api/documents/:id failed:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง' });
  }
});
