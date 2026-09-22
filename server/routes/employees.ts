import { Router } from 'express';
import bcrypt from 'bcryptjs';
import type { RowDataPacket } from 'mysql2';
import { pool } from '../db.ts';
import { nowBangkokDateTime, bangkokDateTimeFrom } from '../lib/datetime.ts';
import { isNotificationCategory, parseMutedCategories } from '../lib/notificationCategories.ts';

export const employeesRouter = Router();

const PASSWORD_COOLDOWN_MESSAGE = 'เปลี่ยนรหัสผ่านได้วันละ 1 ครั้งเท่านั้น';

// Self-service password changes (Settings module) are limited to one per rolling 24h — tracked in
// login.password_changed_at, which only self-changes ever write (an admin resetting someone
// else's password neither sets nor is blocked by it).
async function isPasswordChangeLocked(employeeId: string): Promise<boolean> {
  const cutoff = bangkokDateTimeFrom(new Date(Date.now() - 24 * 60 * 60 * 1000));
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT 1 FROM login WHERE employee_id = ? AND password_changed_at IS NOT NULL AND password_changed_at > ? LIMIT 1',
    [employeeId, cutoff]
  );
  return rows.length > 0;
}

// Used by change-requests.ts once an admin approves a name/nickname change request. Whitelists
// only those two fields — a request's proposedChanges is client-supplied JSON and must never be
// able to touch role/accountType/etc. through this path.
export async function applyEmployeeFields(id: string, changes: Record<string, unknown>): Promise<void> {
  const fields: string[] = [];
  const values: unknown[] = [];
  if (typeof changes.name === 'string' && changes.name.trim()) {
    fields.push('name = ?');
    values.push(changes.name.trim());
  }
  if (typeof changes.nickname === 'string' && changes.nickname.trim()) {
    fields.push('nickname = ?');
    values.push(changes.nickname.trim());
  }
  if (fields.length === 0) return;
  fields.push('updated_at = ?');
  values.push(nowBangkokDateTime());
  await pool.query(`UPDATE employee SET ${fields.join(', ')} WHERE id = ?`, [...values, id]);
}

// `division`/`department` hold real org-chart names now, and that structure is admin-editable at
// runtime (see AppDataContext's orgDivisions, client-side/localStorage only) — there's no fixed
// server-side whitelist to check against, so these are just validated as non-empty strings.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface EmployeeRow extends RowDataPacket {
  id: string;
  name: string;
  nickname: string | null;
  email: string;
  username: string | null;
  phone: string | null;
  address: string | null;
  role: string;
  department: string;
  division: string | null;
  avatar: string | null;
  account_type: string;
  restricted_menu_ids: string | null;
  muted_notification_categories: string | null;
  created_at: string;
}

const ACCOUNT_TYPES = ['employee', 'admin', 'superadmin', 'executive'];

// Mirrors src/lib/permissions.ts's canEditOrDeleteTarget exactly: self-edit always allowed;
// superadmin/executive can touch anyone; a plain admin can touch anyone except another
// admin-like account (admin/superadmin/executive). Re-implemented here (not imported) since this
// is plain server-side data, not a shared client/server module.
function isAdminLike(accountType: string): boolean {
  return accountType === 'admin' || accountType === 'superadmin' || accountType === 'executive';
}
function canEditOrDeleteTarget(actorId: string | undefined, actorType: string | undefined, targetId: string, targetType: string): boolean {
  if (!actorId || !actorType) return false;
  if (actorId === targetId) return true;
  if (actorType === 'superadmin' || actorType === 'executive') return true;
  if (actorType === 'admin') return !isAdminLike(targetType);
  return false;
}

employeesRouter.get('/', async (_req, res) => {
  try {
    const [rows] = await pool.query<EmployeeRow[]>(
      `SELECT e.id, e.name, e.nickname, e.email, l.username, e.phone, e.address, e.role, e.department, e.division, e.avatar, e.account_type, e.restricted_menu_ids, e.muted_notification_categories, e.created_at
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
        phone: r.phone || undefined,
        address: r.address || undefined,
        role: r.role,
        department: r.department,
        division: r.division || undefined,
        avatar: r.avatar,
        accountType: r.account_type,
        restrictedMenuIds: r.restricted_menu_ids ? JSON.parse(r.restricted_menu_ids) : undefined,
        mutedNotificationCategories: parseMutedCategories(r.muted_notification_categories),
        createdAt: r.created_at,
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
  const email = typeof e.email === 'string' && e.email.trim() ? e.email.trim().toLowerCase() : null;
  const username = typeof e.username === 'string' ? e.username.trim() : '';
  const password = typeof e.password === 'string' ? e.password : '';
  const nickname = typeof e.nickname === 'string' && e.nickname.trim() ? e.nickname.trim() : e.name;
  const accountType = ACCOUNT_TYPES.includes(e.accountType) ? e.accountType : 'employee';
  const restrictedMenuIds = Array.isArray(e.restrictedMenuIds) ? e.restrictedMenuIds.filter((id: unknown) => typeof id === 'string') : [];
  const phone = typeof e.phone === 'string' && e.phone.trim() ? e.phone.trim() : null;
  const address = typeof e.address === 'string' && e.address.trim() ? e.address.trim() : null;

  // ผู้บริหาร and หัวหน้าฝ่าย both sit over the whole ฝ่าย, not one แผนก under it — required
  // everywhere else, but these two roles are exempt so they don't get pinned to a department they
  // don't belong to. หัวหน้าแผนก still belongs to exactly one แผนก, so it's not exempt.
  const roleTrim = typeof e.role === 'string' ? e.role.trim() : '';
  const isDepartmentExempt = roleTrim === 'ผู้บริหาร' || roleTrim === 'หัวหน้าฝ่าย';
  const hasDepartment = typeof e.department === 'string' && e.department.trim();
  const hasDivision = typeof e.division === 'string' && e.division.trim();
  if (!e.id || !e.name || !username || !e.role || !hasDivision || !password || (!isDepartmentExempt && !hasDepartment)) {
    return res.status(400).json({ message: 'ข้อมูลไม่ครบถ้วนหรือไม่ถูกต้อง' });
  }
  if (email && !EMAIL_PATTERN.test(email)) {
    return res.status(400).json({ message: 'รูปแบบอีเมลไม่ถูกต้อง' });
  }

  try {
    // email is optional now — `email = ?` against a null parameter never matches any row (not
    // even another blank one), same as the UNIQUE key's own "multiple NULLs are distinct" rule,
    // so this still only flags a real duplicate.
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

    const now = nowBangkokDateTime();
    // Same Super Admin singleton rule as the PUT route below — creating a brand-new employee
    // directly as superadmin still auto-demotes whoever currently holds it.
    if (accountType === 'superadmin') {
      await pool.query(`UPDATE employee SET account_type = 'admin', updated_at = ? WHERE account_type = 'superadmin'`, [now]);
    }
    await pool.query(
      `INSERT INTO employee (id, name, nickname, email, role, department, division, avatar, account_type, restricted_menu_ids, phone, address, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [e.id, e.name, nickname, email, e.role, e.department || '', e.division, e.avatar || null, accountType, restrictedMenuIds.length ? JSON.stringify(restrictedMenuIds) : null, phone, address, now, now]
    );

    const passwordHash = await bcrypt.hash(password, 10);
    await pool.query(
      `INSERT INTO login (employee_id, email, username, password_hash, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, ?, ?)`,
      [e.id, email, username, passwordHash, now, now]
    );

    res.status(201).json({
      id: e.id,
      name: e.name,
      nickname,
      email,
      username,
      role: e.role,
      department: e.department || '',
      division: e.division,
      avatar: e.avatar || null,
      accountType,
      restrictedMenuIds: restrictedMenuIds.length ? restrictedMenuIds : undefined,
      phone: phone || undefined,
      address: address || undefined,
      mutedNotificationCategories: [],
      createdAt: now,
    });
  } catch (err) {
    console.error('POST /api/employees failed:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง' });
  }
});

// Partial update — only touches the columns actually present in the body, so the same endpoint
// serves both the self-service Settings page (avatar/phone/email/mutedNotificationCategories directly;
// name/nickname only for admin-like accounts — everyone else must go through a change request)
// and the admin-only Employee Management edit form (name/nickname/avatar/department/accountType/
// restrictedMenuIds, plus optionally username/password to reset a user's login).
employeesRouter.put('/:id', async (req, res) => {
  const e = req.body ?? {};

  const [[target], [actor]] = await Promise.all([
    pool.query<RowDataPacket[]>('SELECT account_type, name, nickname FROM employee WHERE id = ?', [req.params.id]).then(([rows]) => rows),
    typeof e.actorEmployeeId === 'string' && e.actorEmployeeId
      ? pool.query<RowDataPacket[]>('SELECT account_type FROM employee WHERE id = ?', [e.actorEmployeeId]).then(([rows]) => rows)
      : Promise.resolve([undefined]),
  ]);
  if (!target) return res.status(404).json({ message: 'ไม่พบพนักงานนี้' });
  if (!canEditOrDeleteTarget(e.actorEmployeeId, actor?.account_type, req.params.id, target.account_type)) {
    return res.status(403).json({ message: 'ไม่มีสิทธิ์แก้ไขข้อมูลพนักงานคนนี้' });
  }

  const isSelfEdit = e.actorEmployeeId === req.params.id;

  // A plain employee editing their own account can't change name/nickname directly — that goes
  // through a change request an admin approves (see change-requests.ts). Admin-like accounts, and
  // anyone editing someone else's record, are unaffected. Only an actual change counts, so a form
  // that re-sends the unchanged current values isn't blocked.
  if (isSelfEdit && actor && !isAdminLike(actor.account_type)) {
    const currentNickname = target.nickname || target.name;
    const nameChanged = typeof e.name === 'string' && e.name.trim() && e.name.trim() !== target.name;
    const nicknameChanged = typeof e.nickname === 'string' && e.nickname.trim() && e.nickname.trim() !== currentNickname;
    if (nameChanged || nicknameChanged) {
      return res.status(409).json({ message: 'ต้องขออนุมัติจากแอดมินก่อนจึงจะเปลี่ยนชื่อ/ชื่อเล่นได้', requiresApproval: true });
    }
  }

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
  if ('department' in e) {
    // Explicit-presence check (not a truthy check) so switching a role to an exempt one (ผู้บริหาร/
    // หัวหน้าฝ่าย) can actually clear a stale department value — a truthy check would silently keep
    // the old department in place whenever the client sends '' to clear it.
    employeeFields.push('department = ?');
    employeeValues.push(typeof e.department === 'string' && e.department.trim() ? e.department.trim() : '');
  }
  if (typeof e.division === 'string' && e.division.trim()) {
    employeeFields.push('division = ?');
    employeeValues.push(e.division.trim());
  }
  if (typeof e.accountType === 'string' && ACCOUNT_TYPES.includes(e.accountType)) {
    employeeFields.push('account_type = ?');
    employeeValues.push(e.accountType);
  }
  if ('restrictedMenuIds' in e) {
    const restrictedMenuIds = Array.isArray(e.restrictedMenuIds) ? e.restrictedMenuIds.filter((id: unknown) => typeof id === 'string') : [];
    employeeFields.push('restricted_menu_ids = ?');
    employeeValues.push(restrictedMenuIds.length ? JSON.stringify(restrictedMenuIds) : null);
  }
  if ('phone' in e) {
    employeeFields.push('phone = ?');
    employeeValues.push(typeof e.phone === 'string' && e.phone.trim() ? e.phone.trim() : null);
  }
  if ('address' in e) {
    employeeFields.push('address = ?');
    employeeValues.push(typeof e.address === 'string' && e.address.trim() ? e.address.trim() : null);
  }
  if (Array.isArray(e.mutedNotificationCategories)) {
    // Per-category mute list (Settings → การแจ้งเตือน) — de-duplicated, unknown ids dropped.
    const muted = [...new Set(e.mutedNotificationCategories.filter(isNotificationCategory))];
    employeeFields.push('muted_notification_categories = ?');
    employeeValues.push(muted.length ? JSON.stringify(muted) : null);
  }
  // Contact email — optional, and also mirrored into login.email below (the forgot-password OTP
  // flow looks the account up by that column) so the two never drift apart. Presence-checked like
  // phone/address above so sending an empty string actually clears an existing email instead of
  // being silently ignored — a blank one just means that account can't use "ลืมรหัสผ่าน" via OTP.
  const emailProvided = 'email' in e;
  const newEmail = emailProvided && typeof e.email === 'string' && e.email.trim() ? e.email.trim().toLowerCase() : null;
  if (emailProvided) {
    if (newEmail && !EMAIL_PATTERN.test(newEmail)) {
      return res.status(400).json({ message: 'รูปแบบอีเมลไม่ถูกต้อง' });
    }
    employeeFields.push('email = ?');
    employeeValues.push(newEmail);
  }
  const newUsername = typeof e.username === 'string' && e.username.trim() ? e.username.trim() : null;
  const newPassword = typeof e.password === 'string' && e.password ? e.password : null;

  if (employeeFields.length === 0 && !newUsername && !newPassword) {
    return res.status(400).json({ message: 'ไม่มีข้อมูลที่จะอัปเดต' });
  }

  try {
    if (newEmail) {
      const [existingEmail] = await pool.query<RowDataPacket[]>(
        'SELECT id FROM employee WHERE email = ? AND id != ? LIMIT 1',
        [newEmail, req.params.id]
      );
      if (existingEmail.length > 0) {
        return res.status(409).json({ message: 'มีพนักงานที่ใช้อีเมลนี้อยู่แล้ว' });
      }
    }

    // Same once-a-day limit as the dedicated Settings endpoint below — without this a self-edit
    // through this generic route (e.g. Employee Profile modal on your own account) would be a
    // way around it. Someone else (an admin) resetting this password is never limited.
    if (newPassword && isSelfEdit && (await isPasswordChangeLocked(req.params.id))) {
      return res.status(429).json({ message: PASSWORD_COOLDOWN_MESSAGE });
    }

    if (newUsername) {
      const [[target]] = await pool.query<RowDataPacket[]>(
        'SELECT account_type FROM employee WHERE id = ? LIMIT 1',
        [req.params.id]
      );
      if (target?.account_type === 'admin' || target?.account_type === 'superadmin') {
        return res.status(403).json({ message: 'ไม่สามารถเปลี่ยน Username ของบัญชี Admin/Super Admin ได้' });
      }

      const [existingUsername] = await pool.query<RowDataPacket[]>(
        'SELECT id FROM login WHERE username = ? AND employee_id != ? LIMIT 1',
        [newUsername, req.params.id]
      );
      if (existingUsername.length > 0) {
        return res.status(409).json({ message: 'มี Username นี้ถูกใช้แล้ว' });
      }
    }

    // Super Admin is a singleton — promoting someone new to it auto-demotes whoever currently
    // holds it, so the system is never left with 0 or 2+ superadmins at once.
    if (e.accountType === 'superadmin') {
      await pool.query(
        `UPDATE employee SET account_type = 'admin', updated_at = ? WHERE account_type = 'superadmin' AND id != ?`,
        [nowBangkokDateTime(), req.params.id]
      );
    }

    if (employeeFields.length > 0) {
      employeeFields.push('updated_at = ?');
      employeeValues.push(nowBangkokDateTime());
      await pool.query(`UPDATE employee SET ${employeeFields.join(', ')} WHERE id = ?`, [...employeeValues, req.params.id]);
    }

    if (newUsername || newPassword || emailProvided) {
      const loginFields: string[] = ['updated_at = ?'];
      const loginValues: unknown[] = [nowBangkokDateTime()];
      if (newUsername) {
        loginFields.push('username = ?');
        loginValues.push(newUsername);
      }
      if (emailProvided) {
        loginFields.push('email = ?');
        loginValues.push(newEmail);
      }
      if (newPassword) {
        loginFields.push('password_hash = ?');
        loginValues.push(await bcrypt.hash(newPassword, 10));
        if (isSelfEdit) {
          loginFields.push('password_changed_at = ?');
          loginValues.push(nowBangkokDateTime());
        }
      }
      await pool.query(`UPDATE login SET ${loginFields.join(', ')} WHERE employee_id = ?`, [...loginValues, req.params.id]);
    }

    res.json({ id: req.params.id });
  } catch (err) {
    console.error('PUT /api/employees/:id failed:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง' });
  }
});

// Self-service password change from the Settings page — the only route that's allowed to change
// your own password with an explicit "one per day" rule. Deliberately separate from the generic
// PUT above so its limit and error messages stay specific to this action.
employeesRouter.put('/:id/password', async (req, res) => {
  const b = req.body ?? {};
  if (typeof b.actorEmployeeId !== 'string' || b.actorEmployeeId !== req.params.id) {
    return res.status(403).json({ message: 'เปลี่ยนรหัสผ่านได้เฉพาะบัญชีของตัวเองเท่านั้น' });
  }
  if (typeof b.password !== 'string' || b.password.length < 6) {
    return res.status(400).json({ message: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' });
  }

  try {
    const [loginRows] = await pool.query<RowDataPacket[]>('SELECT 1 FROM login WHERE employee_id = ? LIMIT 1', [req.params.id]);
    if (loginRows.length === 0) return res.status(404).json({ message: 'ไม่พบบัญชีผู้ใช้งานนี้' });

    if (await isPasswordChangeLocked(req.params.id)) {
      return res.status(429).json({ message: PASSWORD_COOLDOWN_MESSAGE });
    }

    const now = nowBangkokDateTime();
    await pool.query(
      'UPDATE login SET password_hash = ?, password_changed_at = ?, updated_at = ? WHERE employee_id = ?',
      [await bcrypt.hash(b.password, 10), now, now, req.params.id]
    );
    res.status(204).end();
  } catch (err) {
    console.error('PUT /api/employees/:id/password failed:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง' });
  }
});

// Removes both the login credentials and the directory row. Deliberately no cross-check against
// task assignments — tasks aren't backend-persisted in this app (still localStorage/mock-only),
// so there's nothing server-side to check against.
employeesRouter.delete('/:id', async (req, res) => {
  const actorEmployeeId = typeof req.query.actorEmployeeId === 'string' ? req.query.actorEmployeeId : undefined;
  // Deleting your own account is never allowed (unlike editing, which self trivially passes) —
  // matches EmployeeManagement.tsx's own deleteDisabled rule.
  if (actorEmployeeId && actorEmployeeId === req.params.id) {
    return res.status(403).json({ message: 'ไม่สามารถลบบัญชีของตัวเองได้' });
  }
  try {
    const [[target], [actor]] = await Promise.all([
      pool.query<RowDataPacket[]>('SELECT account_type FROM employee WHERE id = ?', [req.params.id]).then(([rows]) => rows),
      actorEmployeeId
        ? pool.query<RowDataPacket[]>('SELECT account_type FROM employee WHERE id = ?', [actorEmployeeId]).then(([rows]) => rows)
        : Promise.resolve([undefined]),
    ]);
    if (!target) return res.status(404).json({ message: 'ไม่พบพนักงานนี้' });
    if (!actor || !(actor.account_type === 'superadmin' || actor.account_type === 'executive' || (actor.account_type === 'admin' && !isAdminLike(target.account_type)))) {
      return res.status(403).json({ message: 'ไม่มีสิทธิ์ลบพนักงานคนนี้' });
    }

    await pool.query('DELETE FROM login WHERE employee_id = ?', [req.params.id]);
    await pool.query('DELETE FROM employee WHERE id = ?', [req.params.id]);
    res.status(204).end();
  } catch (err) {
    console.error('DELETE /api/employees/:id failed:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง' });
  }
});
