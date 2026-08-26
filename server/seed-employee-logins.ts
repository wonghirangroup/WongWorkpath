import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { INITIAL_EMPLOYEES } from '../src/data/mockData.ts';
import { pool } from './db.ts';

// Creates a login row for every seeded employee (linked via employee_id) so
// each of them can actually sign in through the real Login page. Everyone
// gets the same default password on first creation — override via
// SEED_EMPLOYEE_PASSWORD. Existing password hashes are left alone on re-run.
const defaultPassword = process.env.SEED_EMPLOYEE_PASSWORD ?? 'Wongwork2026!';

async function seedEmployeeLogins() {
  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  for (const emp of INITIAL_EMPLOYEES) {
    // Starting username derives from the email's local part, matching
    // server/sql/006_add_login_username.sql's backfill for pre-existing rows — not carried
    // through ON DUPLICATE KEY UPDATE below, so a since-customized username isn't reset on re-run.
    const username = emp.username || emp.email.split('@')[0];
    await pool.query(
      `INSERT INTO login (employee_id, email, username, password_hash, is_active)
       VALUES (?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE employee_id = VALUES(employee_id), is_active = 1`,
      [emp.id, emp.email, username, passwordHash]
    );
  }

  console.log(`Seeded ${INITIAL_EMPLOYEES.length} employee logins. Default password: ${defaultPassword}`);
}

seedEmployeeLogins()
  .catch((err) => {
    console.error('Employee login seed failed:', err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
