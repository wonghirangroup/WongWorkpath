import { Router } from 'express';
import type { RowDataPacket } from 'mysql2';
import { pool } from '../db.ts';
import { nowBangkokDateTime } from '../lib/datetime.ts';

export const notificationsRouter = Router();

const TYPES = ['info', 'success', 'warning'];

interface NotificationRowDb extends RowDataPacket {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning';
  link_type: string | null;
  link_id: string | null;
  is_read: number;
  created_at: string;
}

function toNotification(r: NotificationRowDb) {
  return {
    id: r.id,
    title: r.title,
    message: r.message,
    type: r.type,
    linkType: r.link_type ?? undefined,
    linkId: r.link_id ?? undefined,
    read: Boolean(r.is_read),
    timestamp: r.created_at,
  };
}

const SELECT_FIELDS = `id, title, message, type, link_type, link_id, is_read, created_at`;

// Newest 50 for the current employee — the bell dropdown only ever shows a short recent list, and
// this also caps how much a single poll transfers.
notificationsRouter.get('/', async (req, res) => {
  const employeeId = typeof req.query.employeeId === 'string' ? req.query.employeeId : '';
  if (!employeeId) {
    return res.status(400).json({ message: 'กรุณาระบุ employeeId' });
  }
  try {
    const [rows] = await pool.query<NotificationRowDb[]>(
      `SELECT ${SELECT_FIELDS} FROM notification WHERE target_employee_id = ? ORDER BY created_at DESC LIMIT 50`,
      [employeeId]
    );
    res.json(rows.map(toNotification));
  } catch (err) {
    console.error('GET /api/notifications failed:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง' });
  }
});

// Some callers (the due-soon/overdue/meeting-soon periodic check) pass a deterministic id on
// purpose so a repeat poll's INSERT collides on the primary key instead of creating a duplicate —
// that collision (ER_DUP_ENTRY) is treated as success here, not an error, so the client never
// needs its own "have I already notified this one" bookkeeping.
notificationsRouter.post('/', async (req, res) => {
  const n = req.body ?? {};
  if (!n.targetEmployeeId || typeof n.targetEmployeeId !== 'string') {
    return res.status(400).json({ message: 'กรุณาระบุผู้รับการแจ้งเตือน' });
  }
  if (!n.title || typeof n.title !== 'string' || !n.message || typeof n.message !== 'string') {
    return res.status(400).json({ message: 'กรุณาระบุหัวข้อและข้อความ' });
  }
  const type = TYPES.includes(n.type) ? n.type : 'info';
  const id = typeof n.id === 'string' && n.id ? n.id : `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    const now = nowBangkokDateTime();
    await pool.query(
      `INSERT INTO notification (id, target_employee_id, title, message, type, link_type, link_id, is_read, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, FALSE, ?)`,
      [id, n.targetEmployeeId, n.title.trim(), n.message.trim(), type, n.linkType || null, n.linkId || null, now]
    );
    const [[row]] = await pool.query<NotificationRowDb[]>(`SELECT ${SELECT_FIELDS} FROM notification WHERE id = ?`, [id]);
    res.status(201).json(toNotification(row));
  } catch (err) {
    const mysqlErr = err as { code?: string };
    if (mysqlErr.code === 'ER_DUP_ENTRY') {
      const [[row]] = await pool.query<NotificationRowDb[]>(`SELECT ${SELECT_FIELDS} FROM notification WHERE id = ?`, [id]);
      return res.status(200).json(toNotification(row));
    }
    console.error('POST /api/notifications failed:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง' });
  }
});

notificationsRouter.patch('/:id/read', async (req, res) => {
  try {
    await pool.query('UPDATE notification SET is_read = TRUE WHERE id = ?', [req.params.id]);
    res.status(204).send();
  } catch (err) {
    console.error('PATCH /api/notifications/:id/read failed:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง' });
  }
});

notificationsRouter.post('/mark-all-read', async (req, res) => {
  const employeeId = typeof req.body?.employeeId === 'string' ? req.body.employeeId : '';
  if (!employeeId) {
    return res.status(400).json({ message: 'กรุณาระบุ employeeId' });
  }
  try {
    await pool.query('UPDATE notification SET is_read = TRUE WHERE target_employee_id = ?', [employeeId]);
    res.status(204).send();
  } catch (err) {
    console.error('POST /api/notifications/mark-all-read failed:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง' });
  }
});
