import { Router } from 'express';
import type { RowDataPacket } from 'mysql2';
import { pool } from '../db.ts';

export const credentialsRouter = Router();

interface CredentialRow extends RowDataPacket {
  id: string;
  label: string;
  type: string;
  scope: string;
  team: string | null;
  username: string;
  password: string | null;
  key_value: string | null;
  notes: string | null;
  url: string | null;
  logo_url: string | null;
  last_viewed_at: string | null;
  created_by: string;
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
    username: r.username,
    password: r.password ?? undefined,
    keyValue: r.key_value ?? undefined,
    notes: r.notes ?? undefined,
    url: r.url ?? undefined,
    logoUrl: r.logo_url ?? undefined,
    lastViewedAt: r.last_viewed_at ?? undefined,
    createdAt: r.created_at,
    createdBy: r.created_by,
  };
}

credentialsRouter.get('/', async (_req, res) => {
  try {
    const [rows] = await pool.query<CredentialRow[]>(
      `SELECT id, label, type, scope, team, username, password, key_value, notes,
              url, logo_url, last_viewed_at, created_by, created_at
       FROM credential ORDER BY created_at DESC`
    );
    res.json(rows.map(toCredentialItem));
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
    await pool.query(
      `INSERT INTO credential
         (id, label, type, scope, team, username, password, key_value, notes, url, logo_url, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        c.id, c.label, c.type, c.scope ?? 'ส่วนตัว', c.team ?? null,
        c.username ?? '', c.password ?? null, c.keyValue ?? null, c.notes ?? null,
        c.url ?? null, c.logoUrl ?? null, c.createdBy ?? '',
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
         label = ?, type = ?, scope = ?, team = ?, username = ?, password = ?,
         key_value = ?, notes = ?, url = ?, logo_url = ?, last_viewed_at = ?
       WHERE id = ?`,
      [
        c.label, c.type, c.scope, c.team ?? null, c.username, c.password ?? null,
        c.keyValue ?? null, c.notes ?? null, c.url ?? null, c.logoUrl ?? null,
        c.lastViewedAt ?? null, req.params.id,
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
