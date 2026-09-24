import { Router } from 'express';
import type { RowDataPacket } from 'mysql2';
import { pool } from '../db.ts';
import { nowBangkokDateTime } from '../lib/datetime.ts';

export const auditLogsRouter = Router();

interface AuditLogRowDb extends RowDataPacket {
  id: string;
  timestamp: string;
  user_name: string;
  role: string;
  department: string;
  action: string;
  details: string;
}

function toAuditLog(row: AuditLogRowDb) {
  return {
    id: row.id,
    timestamp: row.timestamp,
    user: row.user_name,
    role: row.role,
    department: row.department,
    action: row.action,
    details: row.details,
  };
}

// Loaded whole — every client-side search/date/department/action filter in EmployeeManagement.tsx's
// Log tab runs over the full array in memory, so this returns everything rather than a page.
auditLogsRouter.get('/', async (req, res) => {
  try {
    // The log records who did what across the whole company — only the accounts that can open the
    // Log tab (admin / Super Admin / ผู้บริหาร) get it; everyone else's client just gets an empty list.
    const [[actor]] = await pool.query<RowDataPacket[]>('SELECT account_type FROM employee WHERE id = ?', [req.actorId]);
    if (!actor || !['admin', 'superadmin', 'executive'].includes(actor.account_type)) return res.json([]);

    const [rows] = await pool.query<AuditLogRowDb[]>('SELECT * FROM audit_log ORDER BY timestamp DESC');
    res.json(rows.map(toAuditLog));
  } catch (err) {
    console.error('GET /api/audit-logs failed:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง' });
  }
});

// No role gate — any logged-in action (including a plain employee's own LOGIN/LOGOUT or profile
// edit) writes its own audit entry today, same as the client-side handleLogAudit always allowed.
// Fire-and-forget from the client (see AppDataContext's handleLogAudit): it already builds and
// displays the AuditLog object optimistically, including its own id/timestamp, and just asks this
// endpoint to persist that exact same object — so the row saved here matches what the user is
// already looking at instead of silently diverging under a server-generated id.
// WHO did it, though, is never taken from the request: the name, position and department are read
// from the logged-in account (same "nickname, else name" the client shows), so nobody can write an
// entry that looks like it came from someone else.
auditLogsRouter.post('/', async (req, res) => {
  const b = req.body ?? {};
  const action = typeof b.action === 'string' ? b.action : '';
  const details = typeof b.details === 'string' ? b.details : '';
  if (!action) {
    return res.status(400).json({ message: 'ข้อมูลบันทึกกิจกรรมไม่ครบถ้วน' });
  }

  const id = typeof b.id === 'string' && b.id ? b.id : `log_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const timestamp = typeof b.timestamp === 'string' && b.timestamp ? b.timestamp : nowBangkokDateTime();

  try {
    const [[actor]] = await pool.query<RowDataPacket[]>('SELECT name, nickname, role, department FROM employee WHERE id = ?', [req.actorId]);
    if (!actor) return res.status(401).json({ message: 'ไม่พบบัญชีผู้ใช้งาน กรุณาเข้าสู่ระบบใหม่' });
    const userName: string = actor.nickname || actor.name;
    const role: string = actor.role || '-';
    const department: string = actor.department || '';

    await pool.query(
      'INSERT INTO audit_log (id, timestamp, user_name, role, department, action, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, timestamp, userName, role, department, action, details, nowBangkokDateTime()]
    );
    res.status(201).json({ id, timestamp, user: userName, role, department, action, details });
  } catch (err) {
    console.error('POST /api/audit-logs failed:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง' });
  }
});
