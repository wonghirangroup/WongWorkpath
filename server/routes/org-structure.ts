import { Router } from 'express';
import type { RowDataPacket } from 'mysql2';
import { pool, withTransaction } from '../db.ts';
import { nowBangkokDateTime } from '../lib/datetime.ts';
import { newId } from '../lib/ids.ts';
import { isOrgStructureEditorActor } from '../lib/ownership.ts';

export const orgStructureRouter = Router();

interface DivisionRowDb extends RowDataPacket {
  id: string;
  name: string;
}

interface SectionRowDb extends RowDataPacket {
  id: string;
  division_id: string;
  name: string;
}

const SERVER_ERROR = { message: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง' };
const FORBIDDEN = { message: 'ไม่มีสิทธิ์แก้ไขโครงสร้างองค์กร' };

// Name-based at this API surface, not id-based — matches how the rest of the app already treats
// division/department as identity (employee.division/department are real string names, not
// foreign keys). Every existing consumer of orgDivisions (OrgChart.tsx, orgStructure.ts's
// resolveOrgPlacement) reads exactly this `{ name, sections: string[] }[]` shape already, so this
// migration off localStorage needs zero shape change on the client.
async function loadOrgDivisions(): Promise<{ name: string; sections: string[] }[]> {
  const [divisions] = await pool.query<DivisionRowDb[]>('SELECT id, name FROM org_division ORDER BY sort_order ASC');
  const [sections] = await pool.query<SectionRowDb[]>('SELECT id, division_id, name FROM org_section ORDER BY sort_order ASC');
  return divisions.map((d) => ({
    name: d.name,
    sections: sections.filter((s) => s.division_id === d.id).map((s) => s.name),
  }));
}

orgStructureRouter.get('/', async (_req, res) => {
  try {
    res.json(await loadOrgDivisions());
  } catch (err) {
    console.error('GET /api/org-structure failed:', err);
    res.status(500).json(SERVER_ERROR);
  }
});

orgStructureRouter.post('/divisions', async (req, res) => {
  const b = req.body ?? {};
  const name = typeof b.name === 'string' ? b.name.trim() : '';
  if (!name) return res.status(400).json({ message: 'กรุณาระบุชื่อฝ่าย' });

  try {
    if (!(await isOrgStructureEditorActor(req.actorId))) return res.status(403).json(FORBIDDEN);

    const [[existing]] = await pool.query<DivisionRowDb[]>('SELECT id FROM org_division WHERE name = ?', [name]);
    if (existing) return res.status(409).json({ message: 'มีฝ่ายนี้อยู่แล้ว' });

    const [[maxRow]] = await pool.query<RowDataPacket[]>('SELECT COALESCE(MAX(sort_order), 0) AS maxOrder FROM org_division');
    const now = nowBangkokDateTime();
    await pool.query(
      'INSERT INTO org_division (id, name, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [newId('div'), name, (maxRow.maxOrder as number) + 1, now, now]
    );
    res.status(201).json(await loadOrgDivisions());
  } catch (err) {
    console.error('POST /api/org-structure/divisions failed:', err);
    res.status(500).json(SERVER_ERROR);
  }
});

// Renaming a ฝ่าย/แผนก updates every employee filed under it in the same transaction — the name is
// the link (there is no foreign key), so renaming only the org table used to strand people on a name
// that no longer exists in the chart.
orgStructureRouter.put('/divisions/:name', async (req, res) => {
  const b = req.body ?? {};
  const newName = typeof b.name === 'string' ? b.name.trim() : '';
  if (!newName) return res.status(400).json({ message: 'กรุณาระบุชื่อฝ่าย' });

  try {
    if (!(await isOrgStructureEditorActor(req.actorId))) return res.status(403).json(FORBIDDEN);

    const [[target]] = await pool.query<DivisionRowDb[]>('SELECT id FROM org_division WHERE name = ?', [req.params.name]);
    if (!target) return res.status(404).json({ message: 'ไม่พบฝ่ายนี้' });
    if (newName !== req.params.name) {
      const [[conflict]] = await pool.query<DivisionRowDb[]>('SELECT id FROM org_division WHERE name = ?', [newName]);
      if (conflict) return res.status(409).json({ message: 'มีฝ่ายนี้อยู่แล้ว' });
    }
    const now = nowBangkokDateTime();
    await withTransaction(async (conn) => {
      await conn.query('UPDATE org_division SET name = ?, updated_at = ? WHERE id = ?', [newName, now, target.id]);
      if (newName !== req.params.name) {
        await conn.query('UPDATE employee SET division = ?, updated_at = ? WHERE division = ?', [newName, now, req.params.name]);
      }
    });
    res.json(await loadOrgDivisions());
  } catch (err) {
    console.error('PUT /api/org-structure/divisions/:name failed:', err);
    res.status(500).json(SERVER_ERROR);
  }
});

// Cascades to org_section via ON DELETE CASCADE. Does not touch any employee currently pointing
// at this division's name — same "affected employees just show up as ยังไม่ระบุฝ่าย until
// reassigned" behavior the client-side version always had.
orgStructureRouter.delete('/divisions/:name', async (req, res) => {
  try {
    if (!(await isOrgStructureEditorActor(req.actorId))) return res.status(403).json(FORBIDDEN);

    await pool.query('DELETE FROM org_division WHERE name = ?', [req.params.name]);
    res.json(await loadOrgDivisions());
  } catch (err) {
    console.error('DELETE /api/org-structure/divisions/:name failed:', err);
    res.status(500).json(SERVER_ERROR);
  }
});

orgStructureRouter.post('/divisions/:name/sections', async (req, res) => {
  const b = req.body ?? {};
  const name = typeof b.name === 'string' ? b.name.trim() : '';
  if (!name) return res.status(400).json({ message: 'กรุณาระบุชื่อแผนก' });

  try {
    if (!(await isOrgStructureEditorActor(req.actorId))) return res.status(403).json(FORBIDDEN);

    const [[division]] = await pool.query<DivisionRowDb[]>('SELECT id FROM org_division WHERE name = ?', [req.params.name]);
    if (!division) return res.status(404).json({ message: 'ไม่พบฝ่ายนี้' });

    const [[existing]] = await pool.query<SectionRowDb[]>(
      'SELECT id FROM org_section WHERE division_id = ? AND name = ?',
      [division.id, name]
    );
    if (existing) return res.status(409).json({ message: 'มีแผนกนี้อยู่แล้ว' });

    const [[maxRow]] = await pool.query<RowDataPacket[]>(
      'SELECT COALESCE(MAX(sort_order), 0) AS maxOrder FROM org_section WHERE division_id = ?',
      [division.id]
    );
    const now = nowBangkokDateTime();
    await pool.query(
      'INSERT INTO org_section (id, division_id, name, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [newId('sec'), division.id, name, (maxRow.maxOrder as number) + 1, now, now]
    );
    res.status(201).json(await loadOrgDivisions());
  } catch (err) {
    console.error('POST /api/org-structure/divisions/:name/sections failed:', err);
    res.status(500).json(SERVER_ERROR);
  }
});

// Employees are matched on (ฝ่าย, แผนก) together, so a same-named แผนก in another ฝ่าย is untouched.
// Projects, meetings and team credentials only store the แผนก name with no ฝ่าย beside it — those
// are renamed too, but only when no other ฝ่าย has a แผนก with the same old name (otherwise there is
// no telling which one they meant, and guessing would rename someone else's).
orgStructureRouter.put('/divisions/:name/sections/:sectionName', async (req, res) => {
  const b = req.body ?? {};
  const newName = typeof b.name === 'string' ? b.name.trim() : '';
  if (!newName) return res.status(400).json({ message: 'กรุณาระบุชื่อแผนก' });

  try {
    if (!(await isOrgStructureEditorActor(req.actorId))) return res.status(403).json(FORBIDDEN);

    const [[division]] = await pool.query<DivisionRowDb[]>('SELECT id FROM org_division WHERE name = ?', [req.params.name]);
    if (!division) return res.status(404).json({ message: 'ไม่พบฝ่ายนี้' });

    const [[target]] = await pool.query<SectionRowDb[]>(
      'SELECT id FROM org_section WHERE division_id = ? AND name = ?',
      [division.id, req.params.sectionName]
    );
    if (!target) return res.status(404).json({ message: 'ไม่พบแผนกนี้' });

    if (newName !== req.params.sectionName) {
      const [[conflict]] = await pool.query<SectionRowDb[]>(
        'SELECT id FROM org_section WHERE division_id = ? AND name = ?',
        [division.id, newName]
      );
      if (conflict) return res.status(409).json({ message: 'มีแผนกนี้อยู่แล้ว' });
    }

    const now = nowBangkokDateTime();
    await withTransaction(async (conn) => {
      await conn.query('UPDATE org_section SET name = ?, updated_at = ? WHERE id = ?', [newName, now, target.id]);
      if (newName === req.params.sectionName) return;

      await conn.query(
        'UPDATE employee SET department = ?, updated_at = ? WHERE division = ? AND department = ?',
        [newName, now, req.params.name, req.params.sectionName]
      );
      // The section row above already carries the new name, so "another section still has the old
      // name" means a different ฝ่าย really does own one.
      const [[stillShared]] = await conn.query<RowDataPacket[]>('SELECT COUNT(*) AS cnt FROM org_section WHERE name = ?', [req.params.sectionName]);
      if (Number(stillShared?.cnt ?? 0) === 0) {
        await conn.query('UPDATE project SET department = ?, updated_at = ? WHERE department = ?', [newName, now, req.params.sectionName]);
        await conn.query('UPDATE meeting SET department = ?, updated_at = ? WHERE department = ?', [newName, now, req.params.sectionName]);
        await conn.query(`UPDATE credential SET team = ?, updated_at = ? WHERE scope = 'ทีม' AND team = ?`, [newName, now, req.params.sectionName]);
      }
    });
    res.json(await loadOrgDivisions());
  } catch (err) {
    console.error('PUT /api/org-structure/divisions/:name/sections/:sectionName failed:', err);
    res.status(500).json(SERVER_ERROR);
  }
});

orgStructureRouter.delete('/divisions/:name/sections/:sectionName', async (req, res) => {
  try {
    if (!(await isOrgStructureEditorActor(req.actorId))) return res.status(403).json(FORBIDDEN);

    const [[division]] = await pool.query<DivisionRowDb[]>('SELECT id FROM org_division WHERE name = ?', [req.params.name]);
    if (!division) return res.status(404).json({ message: 'ไม่พบฝ่ายนี้' });

    await pool.query('DELETE FROM org_section WHERE division_id = ? AND name = ?', [division.id, req.params.sectionName]);
    res.json(await loadOrgDivisions());
  } catch (err) {
    console.error('DELETE /api/org-structure/divisions/:name/sections/:sectionName failed:', err);
    res.status(500).json(SERVER_ERROR);
  }
});
