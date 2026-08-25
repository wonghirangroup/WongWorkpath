import { Router } from 'express';
import type { RowDataPacket } from 'mysql2';
import { pool } from '../db.ts';

export const employeesRouter = Router();

interface EmployeeRow extends RowDataPacket {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  avatar: string | null;
  max_workload: number;
}

employeesRouter.get('/', async (_req, res) => {
  try {
    const [rows] = await pool.query<EmployeeRow[]>(
      'SELECT id, name, email, role, department, avatar, max_workload FROM employee ORDER BY id'
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
      }))
    );
  } catch (err) {
    console.error('GET /api/employees failed:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง' });
  }
});
