import { Router } from 'express';
import type { RowDataPacket } from 'mysql2';
import { pool } from '../db.ts';
import { nowBangkokDateTime } from '../lib/datetime.ts';
import { applyProjectFields } from './projects.ts';
import { applyTaskFields } from './project-tasks.ts';
import { isOwner, isExecutiveActor, resolveValidOwnerIds } from '../lib/ownership.ts';

export const changeRequestsRouter = Router();

const ENTITY_TYPES = ['project', 'project_task'];
const REQUEST_TYPES = ['edit', 'delete'];

interface ChangeRequestRowDb extends RowDataPacket {
  id: string;
  entity_type: string;
  entity_id: string;
  request_type: string;
  proposed_changes: string | null;
  reason: string;
  status: string;
  requested_by: string | null;
  requested_at: string;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
}

function toChangeRequest(r: ChangeRequestRowDb) {
  return {
    id: r.id,
    entityType: r.entity_type,
    entityId: r.entity_id,
    requestType: r.request_type,
    proposedChanges: r.proposed_changes ? JSON.parse(r.proposed_changes) : undefined,
    reason: r.reason,
    status: r.status,
    requestedBy: r.requested_by ?? undefined,
    requestedAt: r.requested_at,
    decidedBy: r.decided_by ?? undefined,
    decidedAt: r.decided_at ?? undefined,
    decisionNote: r.decision_note ?? undefined,
  };
}

const SELECT_FIELDS = `id, entity_type, entity_id, request_type, proposed_changes, reason, status, requested_by, requested_at, decided_by, decided_at, decision_note`;

// No filter = every request (small internal-tool dataset — used to power the owner-facing pending
// panel across whichever projects/tasks the current viewer can see). entityType+entityId together
// scope to one entity, e.g. to check "is a request already pending here" before opening a form.
changeRequestsRouter.get('/', async (req, res) => {
  const { entityType, entityId } = req.query;
  try {
    if (typeof entityType === 'string' && typeof entityId === 'string') {
      const [rows] = await pool.query<ChangeRequestRowDb[]>(
        `SELECT ${SELECT_FIELDS} FROM change_request WHERE entity_type = ? AND entity_id = ? ORDER BY requested_at DESC`,
        [entityType, entityId]
      );
      return res.json(rows.map(toChangeRequest));
    }
    const [rows] = await pool.query<ChangeRequestRowDb[]>(
      `SELECT ${SELECT_FIELDS} FROM change_request ORDER BY requested_at DESC`
    );
    res.json(rows.map(toChangeRequest));
  } catch (err) {
    console.error('GET /api/change-requests failed:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง' });
  }
});

changeRequestsRouter.post('/', async (req, res) => {
  const b = req.body ?? {};
  if (!ENTITY_TYPES.includes(b.entityType) || typeof b.entityId !== 'string' || !b.entityId) {
    return res.status(400).json({ message: 'ไม่พบรายการที่ต้องการขอแก้ไข/ลบ' });
  }
  if (!REQUEST_TYPES.includes(b.requestType)) {
    return res.status(400).json({ message: 'ประเภทคำขอไม่ถูกต้อง' });
  }
  if (typeof b.reason !== 'string' || !b.reason.trim()) {
    return res.status(400).json({ message: 'กรุณาระบุเหตุผล' });
  }

  try {
    // At most one pending request per entity at a time — a second person can't file a competing
    // one until the first is decided, so two proposed edits never race each other.
    const [[existingPending]] = await pool.query<RowDataPacket[]>(
      `SELECT id FROM change_request WHERE entity_type = ? AND entity_id = ? AND status = 'pending' LIMIT 1`,
      [b.entityType, b.entityId]
    );
    if (existingPending) {
      return res.status(409).json({ message: 'มีคำขอรออนุมัติอยู่แล้วสำหรับรายการนี้' });
    }

    const id = `CHANGEREQ_${Date.now()}`;
    const now = nowBangkokDateTime();
    await pool.query(
      `INSERT INTO change_request
         (id, entity_type, entity_id, request_type, proposed_changes, reason, status, requested_by, requested_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
      [
        id, b.entityType, b.entityId, b.requestType,
        b.requestType === 'edit' && b.proposedChanges ? JSON.stringify(b.proposedChanges) : null,
        b.reason.trim(), b.requestedBy || null, now, now, now,
      ]
    );

    const [[row]] = await pool.query<ChangeRequestRowDb[]>(`SELECT ${SELECT_FIELDS} FROM change_request WHERE id = ?`, [id]);
    res.status(201).json(toChangeRequest(row));
  } catch (err) {
    console.error('POST /api/change-requests failed:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง' });
  }
});

// Approve: applies the change directly (edit) or performs the real delete (delete) — going
// straight through applyProjectFields/applyTaskFields or a plain DELETE query, never back through
// the public PUT/DELETE routes, so this doesn't get bounced by the very ownership gate that sent
// the request here in the first place. Reject: just marks the row, entity untouched either way.
changeRequestsRouter.put('/:id/decide', async (req, res) => {
  const b = req.body ?? {};
  if (b.decision !== 'approve' && b.decision !== 'reject') {
    return res.status(400).json({ message: 'ต้องระบุผลการพิจารณา' });
  }
  if (typeof b.decidedBy !== 'string' || !b.decidedBy) {
    return res.status(400).json({ message: 'ต้องระบุผู้พิจารณา' });
  }

  try {
    const [[existing]] = await pool.query<ChangeRequestRowDb[]>(`SELECT ${SELECT_FIELDS} FROM change_request WHERE id = ?`, [req.params.id]);
    if (!existing) return res.status(404).json({ message: 'ไม่พบคำขอนี้' });
    if (existing.status !== 'pending') {
      return res.status(409).json({ message: 'คำขอนี้ถูกดำเนินการไปแล้ว' });
    }

    // Only an owner (project) / assignee (task) of the entity being changed, or an executive, may
    // decide its request — mirrors the client's canDecide check (ProjectDetail.tsx/MyWorkspace.tsx),
    // which used to be UI-only: hitting this route directly let anyone approve/reject on someone
    // else's behalf. An entity with no valid owner/assignee stays open to everyone, same "unowned =
    // open" rule as isOwner everywhere else.
    let entityOwnerIds: string[] = [];
    if (existing.entity_type === 'project') {
      const [[project]] = await pool.query<RowDataPacket[]>('SELECT owner_employee_ids FROM project WHERE id = ?', [existing.entity_id]);
      entityOwnerIds = project?.owner_employee_ids ? JSON.parse(project.owner_employee_ids) : [];
    } else {
      const [[task]] = await pool.query<RowDataPacket[]>('SELECT assignee_employee_ids FROM project_task WHERE id = ?', [existing.entity_id]);
      entityOwnerIds = task?.assignee_employee_ids ? JSON.parse(task.assignee_employee_ids) : [];
    }
    const validOwnerIds = await resolveValidOwnerIds(entityOwnerIds);
    const canDecide = (isOwner(validOwnerIds, b.decidedBy) && validOwnerIds.length > 0) || (await isExecutiveActor(b.decidedBy));
    if (!canDecide) {
      return res.status(403).json({ message: 'คุณไม่มีสิทธิ์พิจารณาคำขอนี้' });
    }

    const now = nowBangkokDateTime();

    if (b.decision === 'approve') {
      if (existing.request_type === 'edit') {
        const proposedChanges = existing.proposed_changes ? JSON.parse(existing.proposed_changes) : {};
        if (existing.entity_type === 'project') {
          await applyProjectFields(existing.entity_id, proposedChanges);
        } else {
          await applyTaskFields(existing.entity_id, proposedChanges);
        }
      } else {
        // request_type === 'delete'
        if (existing.entity_type === 'project') {
          await pool.query('DELETE FROM project WHERE id = ?', [existing.entity_id]);
        } else {
          await pool.query('DELETE FROM project_task WHERE id = ?', [existing.entity_id]);
        }
      }
    }

    await pool.query(
      `UPDATE change_request SET status = ?, decided_by = ?, decided_at = ?, decision_note = ?, updated_at = ? WHERE id = ?`,
      [b.decision === 'approve' ? 'approved' : 'rejected', b.decidedBy || null, now, b.note?.trim() || null, now, req.params.id]
    );

    const [[row]] = await pool.query<ChangeRequestRowDb[]>(`SELECT ${SELECT_FIELDS} FROM change_request WHERE id = ?`, [req.params.id]);
    res.json(toChangeRequest(row));
  } catch (err) {
    console.error('PUT /api/change-requests/:id/decide failed:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง' });
  }
});
