import { Router } from 'express';
import type { RowDataPacket } from 'mysql2';
import { pool } from '../db.ts';
import { nowBangkokDateTime } from '../lib/datetime.ts';

export const meetingsRouter = Router();

interface MeetingRowDb extends RowDataPacket {
  id: string;
  project_id: string | null;
  department: string | null;
  title: string;
  description: string | null;
  date: string;
  start_time: string;
  end_time: string | null;
  attendee_ids: string | null;
  location: string | null;
  location_link: string | null;
  meeting_link: string | null;
  created_by: string | null;
  status: 'scheduled' | 'cancelled';
  cancellation_reason: string | null;
}

// Same JSON-array-as-TEXT convention as project.member_employee_ids.
function sanitizeAttendeeIds(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((id): id is string => typeof id === 'string') : [];
}

// date comes back as a plain "YYYY-MM-DD" string (dateStrings: true on the pool — see db.ts), and
// start_time/end_time are stored as plain "HH:mm" text — both already match the client's Meeting
// shape exactly, so unlike Project's dates there's no Thai-formatting step needed here at all.
function toMeeting(r: MeetingRowDb) {
  return {
    id: r.id,
    projectId: r.project_id ?? undefined,
    department: r.department ?? undefined,
    title: r.title,
    description: r.description ?? undefined,
    date: r.date,
    startTime: r.start_time,
    endTime: r.end_time ?? undefined,
    attendeeIds: r.attendee_ids ? JSON.parse(r.attendee_ids) : [],
    location: r.location ?? undefined,
    locationLink: r.location_link ?? undefined,
    meetingLink: r.meeting_link ?? undefined,
    createdBy: r.created_by ?? undefined,
    status: r.status,
    cancellationReason: r.cancellation_reason ?? undefined,
  };
}

const SELECT_FIELDS = `id, project_id, department, title, description, date, start_time, end_time, attendee_ids, location, location_link, meeting_link, created_by, status, cancellation_reason`;

meetingsRouter.get('/', async (_req, res) => {
  try {
    const [rows] = await pool.query<MeetingRowDb[]>(
      `SELECT ${SELECT_FIELDS} FROM meeting ORDER BY date DESC, start_time DESC`
    );
    res.json(rows.map(toMeeting));
  } catch (err) {
    console.error('GET /api/meetings failed:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง' });
  }
});

meetingsRouter.post('/', async (req, res) => {
  const m = req.body ?? {};
  if (!m.title || typeof m.title !== 'string' || !m.title.trim()) {
    return res.status(400).json({ message: 'กรุณาระบุชื่อการประชุม' });
  }
  if (!m.date || !m.startTime) {
    return res.status(400).json({ message: 'กรุณาระบุวันที่และเวลาเริ่มประชุม' });
  }
  const attendeeIds = sanitizeAttendeeIds(m.attendeeIds);

  try {
    const id = `MEETING_${Date.now()}`;
    const now = nowBangkokDateTime();
    await pool.query(
      `INSERT INTO meeting
         (id, project_id, department, title, description, date, start_time, end_time, attendee_ids, location, location_link, meeting_link, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, m.projectId || null, m.department?.trim() || null, m.title.trim(), m.description?.trim() || null, m.date, m.startTime,
        m.endTime || null, attendeeIds.length ? JSON.stringify(attendeeIds) : null, m.location?.trim() || null,
        m.locationLink?.trim() || null, m.meetingLink?.trim() || null, m.createdBy || null, now, now,
      ]
    );

    const [[row]] = await pool.query<MeetingRowDb[]>(`SELECT ${SELECT_FIELDS} FROM meeting WHERE id = ?`, [id]);
    res.status(201).json(toMeeting(row));
  } catch (err) {
    console.error('POST /api/meetings failed:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง' });
  }
});

meetingsRouter.put('/:id', async (req, res) => {
  const m = req.body ?? {};
  const fields: string[] = [];
  const values: unknown[] = [];

  if (typeof m.title === 'string' && m.title.trim()) { fields.push('title = ?'); values.push(m.title.trim()); }
  if ('description' in m) { fields.push('description = ?'); values.push(m.description?.trim() || null); }
  if ('projectId' in m) { fields.push('project_id = ?'); values.push(m.projectId || null); }
  if ('department' in m) { fields.push('department = ?'); values.push(m.department?.trim() || null); }
  if (typeof m.date === 'string' && m.date) { fields.push('date = ?'); values.push(m.date); }
  if (typeof m.startTime === 'string' && m.startTime) { fields.push('start_time = ?'); values.push(m.startTime); }
  if ('endTime' in m) { fields.push('end_time = ?'); values.push(m.endTime || null); }
  if ('attendeeIds' in m) {
    const attendeeIds = sanitizeAttendeeIds(m.attendeeIds);
    fields.push('attendee_ids = ?');
    values.push(attendeeIds.length ? JSON.stringify(attendeeIds) : null);
  }
  if ('location' in m) { fields.push('location = ?'); values.push(m.location?.trim() || null); }
  if ('locationLink' in m) { fields.push('location_link = ?'); values.push(m.locationLink?.trim() || null); }
  if ('meetingLink' in m) { fields.push('meeting_link = ?'); values.push(m.meetingLink?.trim() || null); }

  // Cancelling always requires a reason — set together in the same request so a meeting can
  // never end up cancelled with no explanation on record.
  if (m.status === 'cancelled') {
    if (typeof m.cancellationReason !== 'string' || !m.cancellationReason.trim()) {
      return res.status(400).json({ message: 'กรุณาระบุเหตุผลที่ยกเลิกการประชุม' });
    }
    fields.push('status = ?', 'cancellation_reason = ?');
    values.push('cancelled', m.cancellationReason.trim());
  } else if (m.status === 'scheduled') {
    fields.push('status = ?', 'cancellation_reason = ?');
    values.push('scheduled', null);
  }

  if (fields.length === 0) {
    return res.status(400).json({ message: 'ไม่มีข้อมูลที่จะอัปเดต' });
  }

  try {
    fields.push('updated_at = ?');
    values.push(nowBangkokDateTime());
    await pool.query(`UPDATE meeting SET ${fields.join(', ')} WHERE id = ?`, [...values, req.params.id]);

    const [[row]] = await pool.query<MeetingRowDb[]>(`SELECT ${SELECT_FIELDS} FROM meeting WHERE id = ?`, [req.params.id]);
    res.json(toMeeting(row));
  } catch (err) {
    console.error('PUT /api/meetings/:id failed:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง' });
  }
});

meetingsRouter.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM meeting WHERE id = ?', [req.params.id]);
    res.status(204).end();
  } catch (err) {
    console.error('DELETE /api/meetings/:id failed:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง' });
  }
});
