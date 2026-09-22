import { Router } from 'express';
import type { RowDataPacket } from 'mysql2';
import { pool } from '../db.ts';
import { nowBangkokDateTime } from '../lib/datetime.ts';

export const projectCustomTypesRouter = Router();

interface CustomTypeRowDb extends RowDataPacket {
  id: string;
  label: string;
}

// The 6 built-in codes (see projects.ts's PROJECT_TYPES) — a custom abbreviation can never
// shadow one of these, since that would silently make an existing built-in type mean something
// else on whatever project picks the "custom" one with a colliding code.
const RESERVED_TYPE_IDS = new Set(['P', 'SP', 'I', 'C', 'B', 'FND']);

// Any project's `type` field may hold one of these ids instead of a built-in one (see
// server/routes/projects.ts's isValidProjectType) — kept in a real table so a custom type is
// reusable across future projects too, not just a one-off free-text field, same reasoning as
// project_custom_status.
export async function customTypeIds(): Promise<string[]> {
  const [rows] = await pool.query<CustomTypeRowDb[]>('SELECT id FROM project_custom_type');
  return rows.map((r) => r.id);
}

projectCustomTypesRouter.get('/', async (_req, res) => {
  try {
    const [rows] = await pool.query<CustomTypeRowDb[]>('SELECT id, label FROM project_custom_type ORDER BY created_at ASC');
    res.json(rows.map((r) => ({ id: r.id, label: r.label })));
  } catch (err) {
    console.error('GET /api/project-custom-types failed:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง' });
  }
});

// `abbreviation` becomes the row's id (uppercased) — it's what actually gets embedded into
// generated project codes, so it's validated as a short A-Z0-9 token, not free text.
projectCustomTypesRouter.post('/', async (req, res) => {
  const p = req.body ?? {};
  const label = typeof p.label === 'string' ? p.label.trim() : '';
  const id = typeof p.abbreviation === 'string' ? p.abbreviation.trim().toUpperCase() : '';
  if (!label) return res.status(400).json({ message: 'กรุณาระบุชื่อประเภทโครงการ' });
  if (!/^[A-Z0-9]{1,10}$/.test(id)) {
    return res.status(400).json({ message: 'ตัวย่อประเภทโครงการต้องเป็นตัวอักษร A-Z หรือตัวเลข ความยาว 1-10 ตัว' });
  }
  if (RESERVED_TYPE_IDS.has(id)) {
    return res.status(409).json({ message: 'ตัวย่อนี้ถูกใช้เป็นประเภทมาตรฐานอยู่แล้ว กรุณาตั้งตัวย่ออื่น' });
  }

  try {
    const [[existing]] = await pool.query<CustomTypeRowDb[]>('SELECT id FROM project_custom_type WHERE id = ?', [id]);
    if (existing) return res.status(409).json({ message: 'มีตัวย่อประเภทโครงการนี้อยู่แล้ว' });

    await pool.query(
      'INSERT INTO project_custom_type (id, label, created_by, created_at) VALUES (?, ?, ?, ?)',
      [id, label, p.createdBy || null, nowBangkokDateTime()]
    );
    res.status(201).json({ id, label });
  } catch (err) {
    console.error('POST /api/project-custom-types failed:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง' });
  }
});
