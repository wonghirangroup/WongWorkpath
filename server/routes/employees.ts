import { Router } from 'express';
import bcrypt from 'bcryptjs';
import type { RowDataPacket } from 'mysql2';
import { pool } from '../db.ts';

export const employeesRouter = Router();

const DEPARTMENTS = new Set(['IT', 'HR', 'Marketing', 'Sales', 'Design', 'Finance']);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface EmployeeRow extends RowDataPacket {
  id: string;
  name: string;
  nickname: string | null;
  email: string;
  username: string | null;
  role: string;
  department: string;
  avatar: string | null;
  is_admin: number;
}

employeesRouter.get('/', async (_req, res) => {
  try {
    const [rows] = await pool.query<EmployeeRow[]>(
      `SELECT e.id, e.name, e.nickname, e.email, l.username, e.role, e.department, e.avatar, e.is_admin
       FROM employee e
       LEFT JOIN login l ON l.employee_id = e.id
       ORDER BY e.id`
    );

    // camelCase to match the Employee type in src/types.ts.
    res.json(
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        nickname: r.nickname || r.name,
        email: r.email,
        username: r.username,
        role: r.role,
        department: r.department,
        avatar: r.avatar,
        isAdmin: !!r.is_admin,
      }))
    );
  } catch (err) {
    console.error('GET /api/employees failed:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง' });
  }
});

// Creates both the directory row (`employee`) and its matching login credentials
// (`login`) in one request, so a newly-created account can sign in immediately —
// mirrors what server/seed-employee-logins.ts does for the seeded roster.
employeesRouter.post('/', async (req, res) => {
  const e = req.body ?? {};
  const email = typeof e.email === 'string' ? e.email.trim().toLowerCase() : '';
  const username = typeof e.username === 'string' ? e.username.trim() : '';
  const password = typeof e.password === 'string' ? e.password : '';
  const nickname = typeof e.nickname === 'string' && e.nickname.trim() ? e.nickname.trim() : e.name;
  const isAdmin = !!e.isAdmin;

  if (!e.id || !e.name || !email || !username || !e.role || !DEPARTMENTS.has(e.department) || !password) {
    return res.status(400).json({ message: 'ข้อมูลไม่ครบถ้วนหรือไม่ถูกต้อง' });
  }
  if (!EMAIL_PATTERN.test(email)) {
    return res.status(400).json({ message: 'รูปแบบอีเมลไม่ถูกต้อง' });
  }

  try {
    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM employee WHERE id = ? OR email = ? LIMIT 1',
      [e.id, email]
    );
    if (existing.length > 0) {
      return res.status(409).json({ message: 'มีพนักงานที่ใช้อีเมลนี้อยู่แล้ว' });
    }
    const [existingUsername] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM login WHERE username = ? LIMIT 1',
      [username]
    );
    if (existingUsername.length > 0) {
      return res.status(409).json({ message: 'มี Username นี้ถูกใช้แล้ว' });
    }

    await pool.query(
      `INSERT INTO employee (id, name, nickname, email, role, department, avatar, is_admin)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [e.id, e.name, nickname, email, e.role, e.department, e.avatar || null, isAdmin ? 1 : 0]
    );

    const passwordHash = await bcrypt.hash(password, 10);
    await pool.query(
      `INSERT INTO login (employee_id, email, username, password_hash, is_active)
       VALUES (?, ?, ?, ?, 1)`,
      [e.id, email, username, passwordHash]
    );

    res.status(201).json({
      id: e.id,
      name: e.name,
      nickname,
      email,
      username,
      role: e.role,
      department: e.department,
      avatar: e.avatar || null,
      isAdmin,
    });
  } catch (err) {
    console.error('POST /api/employees failed:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง' });
  }
});

// Partial update — only touches the columns actually present in the body, so the same endpoint
// serves both the self-service "แก้ไขโปรไฟล์" form (nickname/avatar only — a regular account can
// never change its own name, role, username, or password here) and the admin-only Employee
// Management edit form (name/nickname/avatar/department, plus optionally username/password to
// reset a user's login). isAdmin is deliberately excluded here — it's only settable at creation
// time (POST /) and can't be flipped afterward through this endpoint.
employeesRouter.put('/:id', async (req, res) => {
  const e = req.body ?? {};
  const employeeFields: string[] = [];
  const employeeValues: unknown[] = [];

  if (typeof e.name === 'string' && e.name.trim()) {
    employeeFields.push('name = ?');
    employeeValues.push(e.name.trim());
  }
  if (typeof e.nickname === 'string' && e.nickname.trim()) {
    employeeFields.push('nickname = ?');
    employeeValues.push(e.nickname.trim());
  }
  if (typeof e.role === 'string' && e.role.trim()) {
    employeeFields.push('role = ?');
    employeeValues.push(e.role.trim());
  }
  if ('avatar' in e) {
    employeeFields.push('avatar = ?');
    employeeValues.push(e.avatar || null);
  }
  if (typeof e.department === 'string') {
    if (!DEPARTMENTS.has(e.department)) {
      return res.status(400).json({ message: 'แผนกไม่ถูกต้อง' });
    }
    employeeFields.push('department = ?');
    employeeValues.push(e.department);
  }
  const newUsername = typeof e.username === 'string' && e.username.trim() ? e.username.trim() : null;
  const newPassword = typeof e.password === 'string' && e.password ? e.password : null;

  if (employeeFields.length === 0 && !newUsername && !newPassword) {
    return res.status(400).json({ message: 'ไม่มีข้อมูลที่จะอัปเดต' });
  }

  try {
    if (newUsername) {
      const [[target]] = await pool.query<RowDataPacket[]>(
        'SELECT is_admin FROM employee WHERE id = ? LIMIT 1',
        [req.params.id]
      );
      if (target?.is_admin) {
        return res.status(403).json({ message: 'ไม่สามารถเปลี่ยน Username ของบัญชี Admin ได้' });
      }

      const [existingUsername] = await pool.query<RowDataPacket[]>(
        'SELECT id FROM login WHERE username = ? AND employee_id != ? LIMIT 1',
        [newUsername, req.params.id]
      );
      if (existingUsername.length > 0) {
        return res.status(409).json({ message: 'มี Username นี้ถูกใช้แล้ว' });
      }
    }

    if (employeeFields.length > 0) {
      await pool.query(`UPDATE employee SET ${employeeFields.join(', ')} WHERE id = ?`, [...employeeValues, req.params.id]);
    }

    if (newUsername || newPassword) {
      const loginFields: string[] = [];
      const loginValues: unknown[] = [];
      if (newUsername) {
        loginFields.push('username = ?');
        loginValues.push(newUsername);
      }
      if (newPassword) {
        loginFields.push('password_hash = ?');
        loginValues.push(await bcrypt.hash(newPassword, 10));
      }
      await pool.query(`UPDATE login SET ${loginFields.join(', ')} WHERE employee_id = ?`, [...loginValues, req.params.id]);
    }

    res.json({ id: req.params.id });
  } catch (err) {
    console.error('PUT /api/employees/:id failed:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง' });
  }
});

// Removes both the login credentials and the directory row. Deliberately no cross-check against
// task assignments — tasks aren't backend-persisted in this app (still localStorage/mock-only),
// so there's nothing server-side to check against.
employeesRouter.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM login WHERE employee_id = ?', [req.params.id]);
    await pool.query('DELETE FROM employee WHERE id = ?', [req.params.id]);
    res.status(204).end();
  } catch (err) {
    console.error('DELETE /api/employees/:id failed:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง' });
  }
});
