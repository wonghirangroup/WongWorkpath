import 'dotenv/config';
import { INITIAL_EMPLOYEES } from '../src/data/mockData.ts';
import { pool } from './db.ts';

// Upserts the app's existing mock employee directory into the `employee`
// table, so there's real, familiar data to log in with/reference from `login`.
async function seedEmployees() {
  for (const emp of INITIAL_EMPLOYEES) {
    await pool.query(
      `INSERT INTO employee (id, name, email, role, department, avatar, max_workload)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         email = VALUES(email),
         role = VALUES(role),
         department = VALUES(department),
         avatar = VALUES(avatar),
         max_workload = VALUES(max_workload)`,
      [emp.id, emp.name, emp.email, emp.role, emp.department, emp.avatar, emp.maxWorkload]
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
