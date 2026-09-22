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

// Small internal-tool dataset, loaded whole — same convention as change-requests.ts. Every
// existing client-side search/date/department/action filter in EmployeeManagement.tsx's Log tab
// already runs over the full array in memory, so this endpoint needs to keep returning
// everything, not a paginated slice, for that to keep working unmodified. No actorEmployeeId
// gate here: today every logged-in session's browser already loads the entire audit log into
// memory unconditionally (see AppDataContext's old localStorage read) regardless of whether that
// account can even reach the Log tab's UI — this preserves that exact behavior, just from a
// shared table instead of each browser's own copy.
auditLogsRouter.get('/', async (_req, res) => {
  try {
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
auditLogsRouter.post('/', async (req, res) => {
  const b = req.body ?? {};
  const userName = typeof b.user === 'string' ? b.user : '';
  const action = typeof b.action === 'string' ? b.action : '';
  const details = typeof b.details === 'string' ? b.details : '';
  if (!userName || !action) {
    return res.status(400).json({ message: 'ข้อมูลบันทึกกิจกรรมไม่ครบถ้วน' });
  }

  const id = typeof b.id === 'string' && b.id ? b.id : `log_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const timestamp = typeof b.timestamp === 'string' && b.timestamp ? b.timestamp : nowBangkokDateTime();
  const role = typeof b.role === 'string' ? b.role : '-';
  const department = typeof b.department === 'string' ? b.department : '';

  try {
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
