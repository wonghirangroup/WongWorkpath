import { Router } from 'express';
import type { RowDataPacket } from 'mysql2';
import { pool } from '../db.ts';
import { nowBangkokDateTime } from '../lib/datetime.ts';
import { sanitizeReminderDays } from '../lib/notificationCategories.ts';

export const deadlineRemindersRouter = Router();

const SERVER_ERROR = { message: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง' };
const ENTITY_TABLE: Record<string, string> = { project: 'project', task: 'project_task' };

// Everything here belongs to the logged-in person: they only ever read and write their OWN "remind me
// N days before" choices for a project or task, so no one's approval is involved and nobody else is
// affected (the token decides whose rows these are — see requireAuth).

// All of my per-project / per-task choices, as a flat list the client turns into a lookup map.
deadlineRemindersRouter.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT entity_type, entity_id, lead_days FROM deadline_reminder WHERE employee_id = ?',
      [req.actorId]
    );
    res.json(
      rows.map((r) => {
        let leadDays: number[] = [];
        try {
          leadDays = sanitizeReminderDays(JSON.parse(r.lead_days));
        } catch {
          /* unreadable value — treated as "no reminders", the safe reading */
        }
        return { entityType: r.entity_type, entityId: r.entity_id, leadDays };
      })
    );
  } catch (err) {
    console.error('GET /api/deadline-reminders failed:', err);
    res.status(500).json(SERVER_ERROR);
  }
});

// { leadDays: [7, 1] } sets my reminders for this project/task (whole days 1–365, unique, max 6;
// [] = don't remind me ahead of time). { leadDays: null } removes my choice, back to the app default.
deadlineRemindersRouter.put('/:entityType/:entityId', async (req, res) => {
  const table = ENTITY_TABLE[req.params.entityType];
  if (!table) return res.status(400).json({ message: 'ประเภทรายการไม่ถูกต้อง' });
  const leadDays = req.body?.leadDays;
  if (leadDays !== null && !Array.isArray(leadDays)) {
    return res.status(400).json({ message: 'รูปแบบการเตือนก่อนกำหนดไม่ถูกต้อง' });
  }

  try {
    if (leadDays === null) {
      await pool.query('DELETE FROM deadline_reminder WHERE employee_id = ? AND entity_type = ? AND entity_id = ?', [
        req.actorId, req.params.entityType, req.params.entityId,
      ]);
      return res.json({ entityType: req.params.entityType, entityId: req.params.entityId, leadDays: null });
    }

    const [[entity]] = await pool.query<RowDataPacket[]>(`SELECT id FROM ${table} WHERE id = ?`, [req.params.entityId]);
    if (!entity) return res.status(404).json({ message: 'ไม่พบรายการนี้' });

    const clean = sanitizeReminderDays(leadDays);
    await pool.query(
      `INSERT INTO deadline_reminder (employee_id, entity_type, entity_id, lead_days, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE lead_days = VALUES(lead_days), updated_at = VALUES(updated_at)`,
      [req.actorId, req.params.entityType, req.params.entityId, JSON.stringify(clean), nowBangkokDateTime()]
    );
    res.json({ entityType: req.params.entityType, entityId: req.params.entityId, leadDays: clean });
  } catch (err) {
    console.error('PUT /api/deadline-reminders failed:', err);
    res.status(500).json(SERVER_ERROR);
  }
});
