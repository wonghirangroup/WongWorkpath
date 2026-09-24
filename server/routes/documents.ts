import { Router } from 'express';
import type { RowDataPacket } from 'mysql2';
import { pool } from '../db.ts';
import { nowBangkokDateTime } from '../lib/datetime.ts';
import { newId } from '../lib/ids.ts';
import { loadActorContext, canSeeDocument, canAddToProject } from '../lib/access.ts';

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
const SERVER_ERROR = { message: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง' };

// A doc scoped 'ส่วนตัว' is visible only to whoever created it — never shared, regardless of
// project involvement. A doc scoped 'โครงการ' is visible only to people "รับผิดชอบ" that specific
// project, meaning its current owners (ผู้รับผิดชอบหลัก) or members (ผู้รับผิดชอบร่วม) — matches the
// same vocabulary the rest of the app already uses for "who's on this project." ผู้บริหาร sees
// every project's docs regardless of membership — still only their own personal-scope docs.
documentsRouter.get('/', async (req, res) => {
  try {
    const ctx = await loadActorContext(req.actorId!);
    const [rows] = await pool.query<DocumentRowDb[]>(`SELECT ${SELECT_FIELDS} FROM document ORDER BY created_at ASC`);
    res.json(rows.filter((r) => canSeeDocument(ctx, r)).map(toLinkedDoc));
  } catch (err) {
    console.error('GET /api/documents failed:', err);
    res.status(500).json(SERVER_ERROR);
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
    const ctx = await loadActorContext(req.actorId!);
    if (scope === 'โครงการ' && !canAddToProject(ctx, projectId)) {
      // CreateProjectModal creates the project's Drive folder *before* the project row itself exists
      // (it needs the folder's id to save on the project), tagged with the id it is about to use. A
      // project that doesn't exist yet has no team to check membership against, so that one case
      // passes; once the row exists the normal owner/member rule applies.
      const [[existingProject]] = await pool.query<RowDataPacket[]>('SELECT id FROM project WHERE id = ?', [projectId]);
      if (existingProject) {
        return res.status(403).json({ message: 'เพิ่มเอกสารได้เฉพาะโครงการที่คุณรับผิดชอบ' });
      }
    }

    const id = newId('DOC');
    const now = nowBangkokDateTime();
    await pool.query(
      `INSERT INTO document
         (id, name, kind, parent_id, url, file_data_url, file_mime_type, file_size, scope, project_id,
          task_id, creator_employee_id, version, last_updated, updated_by, history, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, d.name.trim(), d.kind, d.parentId || null, d.url || null, d.fileDataUrl || null,
        d.fileMimeType || null, d.fileSize ?? null, scope, projectId, d.taskId || null,
        req.actorId, d.version ?? 1, d.lastUpdated || now, d.updatedBy || '',
        Array.isArray(d.history) ? JSON.stringify(d.history) : null, now, now,
      ]
    );

    const [[row]] = await pool.query<DocumentRowDb[]>(`SELECT ${SELECT_FIELDS} FROM document WHERE id = ?`, [id]);
    res.status(201).json(toLinkedDoc(row));
  } catch (err) {
    console.error('POST /api/documents failed:', err);
    res.status(500).json(SERVER_ERROR);
  }
});

// Whoever can see a doc can edit or delete it (the Drive UI offers both on everything it lists), so
// "can see" is the write gate — a doc you can't see reports 404 instead of confirming it exists.
async function loadWritableDoc(actorId: string, docId: string) {
  const ctx = await loadActorContext(actorId);
  const [[existing]] = await pool.query<DocumentRowDb[]>(`SELECT ${SELECT_FIELDS} FROM document WHERE id = ?`, [docId]);
  if (!existing || !canSeeDocument(ctx, existing)) return { ctx, existing: undefined };
  return { ctx, existing };
}

documentsRouter.put('/:id', async (req, res) => {
  const d = req.body ?? {};
  const fields: string[] = [];
  const values: unknown[] = [];

  if (typeof d.name === 'string' && d.name.trim()) { fields.push('name = ?'); values.push(d.name.trim()); }
  if ('url' in d) { fields.push('url = ?'); values.push(d.url || null); }
  if ('parentId' in d) { fields.push('parent_id = ?'); values.push(d.parentId || null); }
  let nextScope: 'ส่วนตัว' | 'โครงการ' | null = null;
  let nextProjectId: string | null = null;
  if (typeof d.scope === 'string') {
    nextScope = d.scope === 'โครงการ' ? 'โครงการ' : 'ส่วนตัว';
    nextProjectId = nextScope === 'โครงการ' && typeof d.projectId === 'string' && d.projectId ? d.projectId : null;
    fields.push('scope = ?');
    values.push(nextScope);
    fields.push('project_id = ?');
    values.push(nextProjectId);
  }
  if (typeof d.version === 'number') { fields.push('version = ?'); values.push(d.version); }
  if (typeof d.lastUpdated === 'string') { fields.push('last_updated = ?'); values.push(d.lastUpdated); }
  if (typeof d.updatedBy === 'string') { fields.push('updated_by = ?'); values.push(d.updatedBy); }
  if (Array.isArray(d.history)) { fields.push('history = ?'); values.push(JSON.stringify(d.history)); }

  if (fields.length === 0) return res.status(400).json({ message: 'ไม่มีข้อมูลที่จะอัปเดต' });

  try {
    const { ctx, existing } = await loadWritableDoc(req.actorId!, req.params.id);
    if (!existing) return res.status(404).json({ message: 'ไม่พบเอกสารนี้' });
    // Moving a doc into a project means adding to it — same rule as creating one there.
    if (nextScope === 'โครงการ' && nextProjectId !== existing.project_id && !canAddToProject(ctx, nextProjectId)) {
      return res.status(403).json({ message: 'ย้ายเอกสารไปได้เฉพาะโครงการที่คุณรับผิดชอบ' });
    }

    fields.push('updated_at = ?');
    values.push(nowBangkokDateTime());
    await pool.query(`UPDATE document SET ${fields.join(', ')} WHERE id = ?`, [...values, req.params.id]);

    const [[row]] = await pool.query<DocumentRowDb[]>(`SELECT ${SELECT_FIELDS} FROM document WHERE id = ?`, [req.params.id]);
    if (!row) return res.status(404).json({ message: 'ไม่พบเอกสารนี้' });
    res.json(toLinkedDoc(row));
  } catch (err) {
    console.error('PUT /api/documents/:id failed:', err);
    res.status(500).json(SERVER_ERROR);
  }
});

// A folder's children cascade-delete automatically (FK parent_id ON DELETE CASCADE) — no
// breadth-first walk needed client-side like the old localStorage version required.
documentsRouter.delete('/:id', async (req, res) => {
  try {
    const [[stillThere]] = await pool.query<RowDataPacket[]>('SELECT id FROM document WHERE id = ?', [req.params.id]);
    // Already gone (typically swept away with its parent folder a moment ago in a multi-select
    // delete) — the end state the caller wants, so not an error.
    if (!stillThere) return res.status(204).end();

    const { existing } = await loadWritableDoc(req.actorId!, req.params.id);
    if (!existing) return res.status(404).json({ message: 'ไม่พบเอกสารนี้' });

    await pool.query('DELETE FROM document WHERE id = ?', [req.params.id]);
    res.status(204).end();
  } catch (err) {
    console.error('DELETE /api/documents/:id failed:', err);
    res.status(500).json(SERVER_ERROR);
  }
});
