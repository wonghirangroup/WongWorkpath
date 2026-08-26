import 'dotenv/config';
import { INITIAL_EMPLOYEES } from '../src/data/mockData.ts';
import { pool } from './db.ts';

// Upserts the app's existing mock employee directory into the `employee`
// table, so there's real, familiar data to log in with/reference from `login`.
async function seedEmployees() {
  for (const emp of INITIAL_EMPLOYEES) {
    await pool.query(
      `INSERT INTO employee (id, name, nickname, email, role, department, avatar, is_admin)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         -- nickname deliberately left out here — re-running the seed against an existing
         -- employee shouldn't stomp a nickname they've since customized through the app.
         name = VALUES(name),
         email = VALUES(email),
         role = VALUES(role),
         department = VALUES(department),
         avatar = VALUES(avatar),
         is_admin = VALUES(is_admin)`,
      [emp.id, emp.name, emp.nickname || emp.name, emp.email, emp.role, emp.department, emp.avatar, emp.isAdmin ? 1 : 0]
    );
  }

  console.log(`Seeded ${INITIAL_EMPLOYEES.length} employees.`);
}

seedEmployees()
  .catch((err) => {
    console.error('Employee seed failed:', err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
