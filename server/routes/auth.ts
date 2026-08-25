import { Router } from 'express';
import bcrypt from 'bcryptjs';
import type { RowDataPacket } from 'mysql2';
import { pool } from '../db.ts';

export const authRouter = Router();

interface LoginRow extends RowDataPacket {
  id: number;
  employee_id: string | null;
  email: string;
  password_hash: string;
  is_active: number;
}

// Generic message on every failure path so the response never reveals
// whether the email exists — mirrors the wording the mock Login.tsx already uses.
const INVALID_CREDENTIALS_MESSAGE = 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';

authRouter.post('/login', async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!email || !password) {
    return res.status(400).json({ message: INVALID_CREDENTIALS_MESSAGE });
  }

  try {
    const [rows] = await pool.query<LoginRow[]>(
      'SELECT id, employee_id, email, password_hash, is_active FROM login WHERE email = ? LIMIT 1',
      [email]
    );
    const row = rows[0];

    if (!row || !row.is_active) {
      return res.status(401).json({ message: INVALID_CREDENTIALS_MESSAGE });
    }

    const passwordMatches = await bcrypt.compare(password, row.password_hash);
    if (!passwordMatches) {
      return res.status(401).json({ message: INVALID_CREDENTIALS_MESSAGE });
    }

    await pool.query('UPDATE login SET last_login_at = NOW() WHERE id = ?', [row.id]);

    return res.status(200).json({
      id: row.id,
      email: row.email,
      employeeId: row.employee_id,
    });
  } catch (err) {
    console.error('POST /api/auth/login failed:', err);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง' });
  }
});
