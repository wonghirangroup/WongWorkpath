import crypto from 'node:crypto';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { Resend } from 'resend';
import type { RowDataPacket } from 'mysql2';
import { pool } from '../db.ts';
import { nowBangkokDateTime, bangkokDateTimeFrom } from '../lib/datetime.ts';
import { requireAuth, signSessionToken, signResetToken, verifyResetToken } from '../lib/auth.ts';
import { createFailureLimiter } from '../lib/rateLimit.ts';
import { EMPLOYEE_SELECT, toEmployeeDto, type EmployeeRow } from '../lib/employeeDto.ts';

export const authRouter = Router();

// Lazily constructed so a missing RESEND_API_KEY only breaks the forgot-password flow (which
// needs it) rather than crashing the whole server at import time — every other route here works
// fine without it.
let resendClient: Resend | null = null;
function getResendClient(): Resend {
  if (!resendClient) {
    if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not set');
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

const OTP_TTL_MINUTES = 10;
const OTP_RESEND_COOLDOWN_SECONDS = 60;
const MAX_OTP_ATTEMPTS = 5;

// crypto.randomInt, not Math.random — an OTP has to be unpredictable, and Math.random's output
// can be reconstructed from a few observed values.
function generateOtp(): string {
  return String(crypto.randomInt(100000, 1000000));
}

// Failed logins per (IP + username) and per IP alone. Keyed on the IP too so a stranger hammering
// someone's username can't lock that real person out of their own account.
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const loginByAccountLimiter = createFailureLimiter(LOGIN_WINDOW_MS, 5);
const loginByIpLimiter = createFailureLimiter(LOGIN_WINDOW_MS, 30);

interface LoginRow extends RowDataPacket {
  id: number;
  employee_id: string | null;
  username: string;
  password_hash: string;
  is_active: number;
}

interface OtpRow extends RowDataPacket {
  id: number;
  email: string;
  otp_hash: string;
  attempts: number;
  verified: number;
  expires_at: string;
  created_at: string;
}

// Generic message on every failure path so the response never reveals
// whether the username exists — mirrors the wording the mock Login.tsx already uses.
const INVALID_CREDENTIALS_MESSAGE = 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';

authRouter.post('/login', async (req, res) => {
  const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!username || !password) {
    return res.status(400).json({ message: INVALID_CREDENTIALS_MESSAGE });
  }

  const ip = req.ip ?? 'unknown';
  const accountKey = `${ip}|${username.toLowerCase()}`;
  const lockedFor = Math.max(loginByAccountLimiter.lockedForSeconds(accountKey), loginByIpLimiter.lockedForSeconds(ip));
  if (lockedFor > 0) {
    return res.status(429).json({ message: `ลองเข้าสู่ระบบผิดหลายครั้งเกินไป กรุณารอ ${Math.ceil(lockedFor / 60)} นาทีแล้วลองใหม่อีกครั้ง` });
  }
  const failLogin = () => {
    loginByAccountLimiter.recordFailure(accountKey);
    loginByIpLimiter.recordFailure(ip);
    return res.status(401).json({ message: INVALID_CREDENTIALS_MESSAGE });
  };

  try {
    const [rows] = await pool.query<LoginRow[]>(
      'SELECT id, employee_id, username, password_hash, is_active FROM login WHERE username = ? LIMIT 1',
      [username]
    );
    const row = rows[0];

    if (!row || !row.is_active) return failLogin();

    const passwordMatches = await bcrypt.compare(password, row.password_hash);
    if (!passwordMatches) return failLogin();

    const [employeeRows] = row.employee_id
      ? await pool.query<EmployeeRow[]>(`${EMPLOYEE_SELECT} WHERE e.id = ? LIMIT 1`, [row.employee_id])
      : [[] as EmployeeRow[]];
    if (!row.employee_id || employeeRows.length === 0) {
      return res.status(403).json({ message: 'บัญชีนี้ยังไม่ได้ผูกกับข้อมูลพนักงานในระบบ' });
    }

    loginByAccountLimiter.reset(accountKey);
    await pool.query('UPDATE login SET last_login_at = ? WHERE id = ?', [nowBangkokDateTime(), row.id]);

    // Hands back the employee itself so the client doesn't need the whole directory before anyone
    // has signed in (every other endpoint now requires the token issued here).
    return res.status(200).json({
      id: row.id,
      username: row.username,
      employeeId: row.employee_id,
      token: signSessionToken(row.employee_id),
      employee: toEmployeeDto(employeeRows[0]),
    });
  } catch (err) {
    console.error('POST /api/auth/login failed:', err);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง' });
  }
});

// Restores a session on page reload: proves the stored token is still good and returns the employee
// it belongs to, so a role change made since the last login shows up straight away.
authRouter.get('/me', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query<EmployeeRow[]>(`${EMPLOYEE_SELECT} WHERE e.id = ? LIMIT 1`, [req.actorId]);
    if (rows.length === 0) return res.status(401).json({ message: 'กรุณาเข้าสู่ระบบใหม่อีกครั้ง', code: 'UNAUTHENTICATED' });
    return res.json(toEmployeeDto(rows[0]));
  } catch (err) {
    console.error('GET /api/auth/me failed:', err);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง' });
  }
});

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GENERIC_OTP_SENT_MESSAGE = 'หากอีเมลนี้อยู่ในระบบ เราได้ส่งรหัส OTP ไปให้แล้ว';

// Always the same response whether or not the email exists — same "never reveal" rule as
// /login, just applied here to email lookups instead of usernames.
authRouter.post('/forgot-password', async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!EMAIL_PATTERN.test(email)) {
    return res.status(400).json({ message: 'กรุณากรอกอีเมลให้ถูกต้อง' });
  }

  try {
    const [loginRows] = await pool.query<LoginRow[]>(
      'SELECT id FROM login WHERE email = ? AND is_active = 1 LIMIT 1',
      [email]
    );
    if (loginRows.length === 0) {
      return res.status(200).json({ message: GENERIC_OTP_SENT_MESSAGE });
    }

    // Client-side already enforces a 59s resend cooldown, but that's just UX — this is the real
    // guard against someone hammering the endpoint to spam an inbox.
    const [recentRows] = await pool.query<OtpRow[]>(
      'SELECT id FROM password_reset_otp WHERE email = ? AND created_at > ? ORDER BY id DESC LIMIT 1',
      [email, bangkokDateTimeFrom(new Date(Date.now() - OTP_RESEND_COOLDOWN_SECONDS * 1000))]
    );
    if (recentRows.length > 0) {
      return res.status(200).json({ message: GENERIC_OTP_SENT_MESSAGE });
    }

    const otp = generateOtp();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = bangkokDateTimeFrom(new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000));

    await pool.query(
      'INSERT INTO password_reset_otp (email, otp_hash, expires_at, created_at) VALUES (?, ?, ?, ?)',
      [email, otpHash, expiresAt, nowBangkokDateTime()]
    );

    try {
      const { error: sendError } = await getResendClient().emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev',
        to: email,
        subject: `รหัส OTP สำหรับรีเซ็ตรหัสผ่าน: ${otp}`,
        html: `<div style="font-family:sans-serif">
          <p>รหัส OTP สำหรับรีเซ็ตรหัสผ่านของคุณคือ</p>
          <p style="font-size:28px;font-weight:bold;letter-spacing:4px">${otp}</p>
          <p>รหัสนี้จะหมดอายุใน ${OTP_TTL_MINUTES} นาที หากคุณไม่ได้เป็นผู้ขอ กรุณาเพิกเฉยต่ออีเมลนี้</p>
        </div>`,
      });
      // The Resend SDK resolves (never throws) on an API-level failure — invalid key, unverified
      // domain, sandbox restrictions — returning { data: null, error } instead of rejecting. A
      // plain try/catch around the call above only ever catches a thrown exception (e.g.
      // getResendClient() itself throwing on a missing key, or a network-level fetch failure), so
      // this explicit check is required or a real send failure would silently report success.
      if (sendError) {
        console.error('Resend send failed:', sendError);
        return res.status(502).json({ message: 'ส่งอีเมล OTP ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' });
      }
    } catch (sendErr) {
      console.error('Resend send failed:', sendErr);
      return res.status(502).json({ message: 'ส่งอีเมล OTP ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' });
    }

    return res.status(200).json({ message: GENERIC_OTP_SENT_MESSAGE });
  } catch (err) {
    console.error('POST /api/auth/forgot-password failed:', err);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง' });
  }
});

authRouter.post('/verify-otp', async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const otp = typeof req.body?.otp === 'string' ? req.body.otp.trim() : '';
  const INVALID_OTP_MESSAGE = 'รหัส OTP ไม่ถูกต้องหรือหมดอายุ';

  if (!email || !otp) {
    return res.status(400).json({ message: INVALID_OTP_MESSAGE });
  }

  try {
    const [rows] = await pool.query<OtpRow[]>(
      'SELECT * FROM password_reset_otp WHERE email = ? AND verified = 0 AND expires_at > ? ORDER BY id DESC LIMIT 1',
      [email, nowBangkokDateTime()]
    );
    const row = rows[0];
    if (!row) {
      return res.status(400).json({ message: INVALID_OTP_MESSAGE });
    }
    if (row.attempts >= MAX_OTP_ATTEMPTS) {
      return res.status(429).json({ message: 'ลองผิดหลายครั้งเกินไป กรุณาขอรหัส OTP ใหม่' });
    }

    const matches = await bcrypt.compare(otp, row.otp_hash);
    if (!matches) {
      await pool.query('UPDATE password_reset_otp SET attempts = attempts + 1 WHERE id = ?', [row.id]);
      return res.status(400).json({ message: INVALID_OTP_MESSAGE });
    }

    await pool.query('UPDATE password_reset_otp SET verified = 1 WHERE id = ?', [row.id]);
    return res.status(200).json({ message: 'ยืนยันรหัส OTP สำเร็จ', resetToken: signResetToken(email, row.id) });
  } catch (err) {
    console.error('POST /api/auth/verify-otp failed:', err);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง' });
  }
});

// No OTP re-entry here on purpose — /verify-otp already consumed it by flipping `verified` and
// handed back a signed resetToken. That token, not merely "this email verified something a moment
// ago", is what authorises the change: only whoever actually entered the OTP holds it.
authRouter.post('/reset-password', async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
  const resetToken = typeof req.body?.resetToken === 'string' ? req.body.resetToken : '';
  const NOT_VERIFIED_MESSAGE = 'กรุณายืนยันรหัส OTP ก่อนตั้งรหัสผ่านใหม่';

  if (!email || newPassword.length < 6) {
    return res.status(400).json({ message: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร' });
  }
  const proof = resetToken ? verifyResetToken(resetToken, email) : null;
  if (!proof) {
    return res.status(400).json({ message: NOT_VERIFIED_MESSAGE });
  }

  try {
    const [rows] = await pool.query<OtpRow[]>(
      'SELECT * FROM password_reset_otp WHERE id = ? AND email = ? AND verified = 1 AND expires_at > ? LIMIT 1',
      [proof.otpRowId, email, nowBangkokDateTime()]
    );
    const row = rows[0];
    if (!row) {
      return res.status(400).json({ message: NOT_VERIFIED_MESSAGE });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await pool.query(
      'UPDATE login SET password_hash = ?, updated_at = ? WHERE email = ?',
      [passwordHash, nowBangkokDateTime(), email]
    );
    // Burn the OTP row so it can't be replayed for a second reset.
    await pool.query('DELETE FROM password_reset_otp WHERE id = ?', [row.id]);

    return res.status(200).json({ message: 'เปลี่ยนรหัสผ่านสำเร็จ' });
  } catch (err) {
    console.error('POST /api/auth/reset-password failed:', err);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง' });
  }
});
