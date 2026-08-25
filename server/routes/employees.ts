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
  email: string;
  role: string;
  department: string;
  avatar: string | null;
  max_workload: number;
  is_admin: number;
}

employeesRouter.get('/', async (_req, res) => {
  try {
    const [rows] = await pool.query<EmployeeRow[]>(
      'SELECT id, name, email, role, department, avatar, max_workload, is_admin FROM employee ORDER BY id'
    );

    // camelCase to match the Employee type in src/types.ts.
    res.json(
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        role: r.role,
        department: r.department,
        avatar: r.avatar,
        maxWorkload: r.max_workload,
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
  const password = typeof e.password === 'string' ? e.password : '';

  if (!e.id || !e.name || !email || !e.role || !DEPARTMENTS.has(e.department) || !password) {
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

    await pool.query(
      `INSERT INTO employee (id, name, email, role, department, avatar, max_workload)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [e.id, e.name, email, e.role, e.department, e.avatar || null, Number(e.maxWorkload) || 0]
    );

    const passwordHash = await bcrypt.hash(password, 10);
    await pool.query(
      `INSERT INTO login (employee_id, email, password_hash, is_active)
       VALUES (?, ?, ?, 1)`,
      [e.id, email, passwordHash]
    );

    res.status(201).json({
      id: e.id,
      name: e.name,
      email,
      role: e.role,
      department: e.department,
      avatar: e.avatar || null,
      maxWorkload: Number(e.maxWorkload) || 0,
      isAdmin: false,
    });
  } catch (err) {
    console.error('POST /api/employees failed:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง' });
  }
});

// Self-service profile edit — deliberately narrow: only name/role/avatar are writable here.
// Email is excluded (it's the login key, changing it needs to touch the `login` row too) and
// department/isAdmin are excluded since those are access-control-relevant and shouldn't be
// something an account can change on itself.
employeesRouter.put('/:id', async (req, res) => {
  const e = req.body ?? {};
  if (!e.name || !e.role) {
    return res.status(400).json({ message: 'ข้อมูลไม่ครบถ้วน' });
  }

  try {
    await pool.query(
      'UPDATE employee SET name = ?, role = ?, avatar = ? WHERE id = ?',
      [e.name, e.role, e.avatar || null, req.params.id]
    );
    res.json({ id: req.params.id });
  } catch (err) {
    console.error('PUT /api/employees/:id failed:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง' });
  }
});
