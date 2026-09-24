import { Router } from 'express';
import type { RowDataPacket } from 'mysql2';
import { pool } from '../db.ts';
import { nowBangkokDateTime } from '../lib/datetime.ts';
import { loadActorContext, canSeeCredential, canSeeProject, type ActorContext } from '../lib/access.ts';

export const credentialsRouter = Router();

const CREDENTIAL_TYPES = ['Username & Password', 'API Key', 'Bank Account', 'Access Token'];
const CREDENTIAL_SCOPES = ['ส่วนตัว', 'ทีม', 'โครงการ'];

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

const SERVER_ERROR = { message: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง' };

// Where a credential is allowed to be filed: your own personal vault, your own team's, or a project
// you actually work on. Without this any account could drop (or move) a secret into someone else's
// team/project. ผู้บริหาร may file into any team/project, mirroring what they can already see.
function scopeTargetError(ctx: ActorContext, scope: string, team: string | null, projectId: string | null): string | null {
  if (!CREDENTIAL_SCOPES.includes(scope)) return 'ขอบเขตของรหัสผ่านไม่ถูกต้อง';
  if (scope === 'ทีม' && !ctx.isExecutive && (team ?? '') !== (ctx.department ?? '')) return 'เพิ่มรหัสผ่านให้ทีมของตัวเองเท่านั้น';
  if (scope === 'โครงการ' && !canSeeProject(ctx, projectId)) return 'เพิ่มรหัสผ่านได้เฉพาะโครงการที่คุณรับผิดชอบ';
  return null;
}

// Server-enforced visibility, matching documents.ts's own pattern: 'ส่วนตัว' only to its creator
// (by real employee id, not display name — the old client-side check matched by name and broke on
// renames/duplicates); 'ทีม' only to the same department; 'โครงการ' only to that project's owners
// or members. ผู้บริหาร sees every 'ทีม'/'โครงการ' row regardless, but still only their own
// 'ส่วนตัว' rows — same split Docs uses for its own executive bypass.
credentialsRouter.get('/', async (req, res) => {
  try {
    const ctx = await loadActorContext(req.actorId!);
    const [rows] = await pool.query<CredentialRow[]>(`SELECT ${SELECT_FIELDS} FROM credential ORDER BY created_at DESC`);
    res.json(rows.filter((r) => canSeeCredential(ctx, r)).map(toCredentialItem));
  } catch (err) {
    console.error('GET /api/credentials failed:', err);
    res.status(500).json(SERVER_ERROR);
  }
});

credentialsRouter.post('/', async (req, res) => {
  const c = req.body ?? {};
  if (!c.id || !c.label || !c.type) {
    return res.status(400).json({ message: 'ข้อมูลไม่ครบถ้วน' });
  }
  if (!CREDENTIAL_TYPES.includes(c.type)) {
    return res.status(400).json({ message: 'ประเภทรหัสผ่านไม่ถูกต้อง' });
  }
  const scope = c.scope ?? 'ส่วนตัว';

  try {
    const ctx = await loadActorContext(req.actorId!);
    const targetError = scopeTargetError(ctx, scope, c.team ?? null, c.projectId ?? null);
    if (targetError) return res.status(403).json({ message: targetError });

    const now = nowBangkokDateTime();
    await pool.query(
      `INSERT INTO credential
         (id, label, type, scope, team, project_id, username, password, key_value, notes, url, logo_url, created_by, creator_employee_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        c.id, c.label, c.type, scope, c.team ?? null, c.projectId ?? null,
        c.username ?? '', c.password ?? null, c.keyValue ?? null, c.notes ?? null,
        c.url ?? null, c.logoUrl ?? null, c.createdBy ?? '', req.actorId, now, now,
      ]
    );
    res.status(201).json({ id: c.id });
  } catch (err) {
    console.error('POST /api/credentials failed:', err);
    res.status(500).json(SERVER_ERROR);
  }
});

// Anyone who can see a credential may edit or delete it (the vault UI shows both actions on every
// card it lists) — so "can see" is the write gate too, and a row you can't see reports 404 rather
// than confirming it exists.
credentialsRouter.put('/:id', async (req, res) => {
  const c = req.body ?? {};
  try {
    const ctx = await loadActorContext(req.actorId!);
    const [[existing]] = await pool.query<CredentialRow[]>(`SELECT ${SELECT_FIELDS} FROM credential WHERE id = ?`, [req.params.id]);
    if (!existing || !canSeeCredential(ctx, existing)) return res.status(404).json({ message: 'ไม่พบรายการนี้' });

    if (c.type !== undefined && !CREDENTIAL_TYPES.includes(c.type)) {
      return res.status(400).json({ message: 'ประเภทรหัสผ่านไม่ถูกต้อง' });
    }
    const targetError = scopeTargetError(ctx, c.scope, c.team ?? null, c.projectId ?? null);
    if (targetError) return res.status(403).json({ message: targetError });

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
    res.status(500).json(SERVER_ERROR);
  }
});

credentialsRouter.delete('/:id', async (req, res) => {
  try {
    const ctx = await loadActorContext(req.actorId!);
    const [[existing]] = await pool.query<CredentialRow[]>(`SELECT ${SELECT_FIELDS} FROM credential WHERE id = ?`, [req.params.id]);
    if (!existing || !canSeeCredential(ctx, existing)) return res.status(404).json({ message: 'ไม่พบรายการนี้' });

    await pool.query('DELETE FROM credential WHERE id = ?', [req.params.id]);
    res.status(204).end();
  } catch (err) {
    console.error('DELETE /api/credentials/:id failed:', err);
    res.status(500).json(SERVER_ERROR);
  }
});
