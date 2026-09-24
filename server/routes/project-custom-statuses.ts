import { Router } from 'express';
import type { RowDataPacket } from 'mysql2';
import { pool } from '../db.ts';
import { nowBangkokDateTime } from '../lib/datetime.ts';

export const projectCustomStatusesRouter = Router();

interface CustomStatusRowDb extends RowDataPacket {
  id: string;
  label: string;
}

// Any project's `status` field may hold one of these ids (see server/routes/projects.ts's
// isValidProjectStatus) — kept in a real table (not just a client-side list) so it's usable
// exactly like a built-in status: assignable, filterable, and shared across every user.
export async function customStatusIds(): Promise<string[]> {
  const [rows] = await pool.query<CustomStatusRowDb[]>('SELECT id FROM project_custom_status');
  return rows.map((r) => r.id);
}

projectCustomStatusesRouter.get('/', async (_req, res) => {
  try {
    const [rows] = await pool.query<CustomStatusRowDb[]>('SELECT id, label FROM project_custom_status ORDER BY created_at ASC');
    res.json(rows.map((r) => ({ id: r.id, label: r.label })));
  } catch (err) {
    console.error('GET /api/project-custom-statuses failed:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง' });
  }
});

projectCustomStatusesRouter.post('/', async (req, res) => {
  const p = req.body ?? {};
  const label = typeof p.label === 'string' ? p.label.trim() : '';
  if (!label) {
    return res.status(400).json({ message: 'กรุณาระบุชื่อสถานะ' });
  }

  try {
    const id = `cs_${Date.now().toString(36)}`;
    const now = nowBangkokDateTime();
    await pool.query(
      'INSERT INTO project_custom_status (id, label, created_by, created_at) VALUES (?, ?, ?, ?)',
      [id, label, req.actorId, now]
    );
    res.status(201).json({ id, label });
  } catch (err) {
    console.error('POST /api/project-custom-statuses failed:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง' });
  }
});

// A status that projects are still using can't be deleted — they'd be left holding a raw id like
// "cs_mgx3k2a1" that renders as nothing meaningful. The user has to move those projects to another
// status first.
projectCustomStatusesRouter.delete('/:id', async (req, res) => {
  try {
    const [[usage]] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) AS cnt FROM project WHERE status = ?', [req.params.id]);
    const inUse = Number(usage?.cnt ?? 0);
    if (inUse > 0) {
      return res.status(409).json({ message: `ลบสถานะนี้ไม่ได้ เพราะยังมี ${inUse} โครงการที่ใช้สถานะนี้อยู่ กรุณาเปลี่ยนสถานะของโครงการเหล่านั้นก่อน` });
    }
    await pool.query('DELETE FROM project_custom_status WHERE id = ?', [req.params.id]);
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /api/project-custom-statuses/:id failed:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง' });
  }
});
