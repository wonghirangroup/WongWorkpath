import { Router } from 'express';
import type { RowDataPacket } from 'mysql2';
import { pool } from '../db.ts';
import { nowBangkokDateTime } from '../lib/datetime.ts';
import { isExecutiveActor } from '../lib/ownership.ts';

export const credentialsRouter = Router();

interface CredentialRow extends RowDataPacket {
  id: string;
  label: string;
  type: string;
  scope: string;
  team: string | null;
  project_id: string | null;
  username: string;
  password: string | null;
  key_value: string | null;
  notes: string | null;
  url: string | null;
  logo_url: string | null;
  created_by: string;
  creator_employee_id: string | null;
  created_at: string;
}

// camelCase to match the CredentialItem type in src/types.ts — null optional
// fields collapse to undefined so JSON.stringify drops them, same shape the
// client already produces when saving straight to localStorage.
function toCredentialItem(r: CredentialRow) {
  return {
    id: r.id,
    label: r.label,
    type: r.type,
    scope: r.scope,
    team: r.team ?? undefined,
    projectId: r.project_id ?? undefined,
    username: r.username,
    password: r.password ?? undefined,
    keyValue: r.key_value ?? undefined,
    notes: r.notes ?? undefined,
    url: r.url ?? undefined,
    logoUrl: r.logo_url ?? undefined,
    createdAt: r.created_at,
    createdBy: r.created_by,
    creatorEmployeeId: r.creator_employee_id ?? undefined,
  };
}

const SELECT_FIELDS = `id, label, type, scope, team, project_id, username, password, key_value, notes,
              url, logo_url, created_by, creator_employee_id, created_at`;

// Server-enforced visibility, matching documents.ts's own pattern: 'ส่วนตัว' only to its creator
// (by real employee id, not display name — the old client-side check matched by name and broke on
// renames/duplicates); 'ทีม' only to the same department; 'โครงการ' only to that project's owners
// or members. ผู้บริหาร sees every 'ทีม'/'โครงการ' row regardless, but still only their own
// 'ส่วนตัว' rows — same split Docs uses for its own executive bypass.
credentialsRouter.get('/', async (req, res) => {
  const actorEmployeeId = typeof req.query.actorEmployeeId === 'string' ? req.query.actorEmployeeId : undefined;
  if (!actorEmployeeId) return res.json([]);

  try {
    const [[actor]] = await pool.query<RowDataPacket[]>('SELECT department FROM employee WHERE id = ?', [actorEmployeeId]);
    const actorDepartment: string | null = actor?.department ?? null;
    const isExecutive = await isExecutiveActor(actorEmployeeId);

    const [rows] = await pool.query<CredentialRow[]>(`SELECT ${SELECT_FIELDS} FROM credential ORDER BY created_at DESC`);

    let myProjectIds: Set<string> | null = null;
    if (!isExecutive) {
      const [projectRows] = await pool.query<RowDataPacket[]>('SELECT id, owner_employee_ids, member_employee_ids FROM project');
      myProjectIds = new Set(
        projectRows
          .filter((p) => {
            const owners: string[] = p.owner_employee_ids ? JSON.parse(p.owner_employee_ids) : [];
            const members: string[] = p.member_employee_ids ? JSON.parse(p.member_employee_ids) : [];
            return owners.includes(actorEmployeeId) || members.includes(actorEmployeeId);
          })
          .map((p) => p.id)
      );
    }

    const visible = rows.filter((r) => {
      if (r.scope === 'ส่วนตัว') return r.creator_employee_id === actorEmployeeId;
      if (r.scope === 'ทีม') return isExecutive || (actorDepartment !== null && r.team === actorDepartment);
      return isExecutive || Boolean(r.project_id && myProjectIds?.has(r.project_id));
    });
    res.json(visible.map(toCredentialItem));
  } catch (err) {
    console.error('GET /api/credentials failed:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง' });
  }
});

credentialsRouter.post('/', async (req, res) => {
  const c = req.body ?? {};
  if (!c.id || !c.label || !c.type) {
    return res.status(400).json({ message: 'ข้อมูลไม่ครบถ้วน' });
  }

  try {
    const now = nowBangkokDateTime();
    await pool.query(
      `INSERT INTO credential
         (id, label, type, scope, team, project_id, username, password, key_value, notes, url, logo_url, created_by, creator_employee_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        c.id, c.label, c.type, c.scope ?? 'ส่วนตัว', c.team ?? null, c.projectId ?? null,
        c.username ?? '', c.password ?? null, c.keyValue ?? null, c.notes ?? null,
        c.url ?? null, c.logoUrl ?? null, c.createdBy ?? '', c.creatorEmployeeId ?? null, now, now,
      ]
    );
    res.status(201).json({ id: c.id });
  } catch (err) {
    console.error('POST /api/credentials failed:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง' });
  }
});

credentialsRouter.put('/:id', async (req, res) => {
  const c = req.body ?? {};
  try {
    await pool.query(
      `UPDATE credential SET
         label = ?, type = ?, scope = ?, team = ?, project_id = ?, username = ?, password = ?,
         key_value = ?, notes = ?, url = ?, logo_url = ?, updated_at = ?
       WHERE id = ?`,
      [
        c.label, c.type, c.scope, c.team ?? null, c.projectId ?? null, c.username, c.password ?? null,
        c.keyValue ?? null, c.notes ?? null, c.url ?? null, c.logoUrl ?? null,
        nowBangkokDateTime(), req.params.id,
      ]
    );
    res.json({ id: req.params.id });
  } catch (err) {
    console.error('PUT /api/credentials/:id failed:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง' });
  }
});

credentialsRouter.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM credential WHERE id = ?', [req.params.id]);
    res.status(204).end();
  } catch (err) {
    console.error('DELETE /api/credentials/:id failed:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง' });
  }
});
