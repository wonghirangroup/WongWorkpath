import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool } from './db.ts';

// Inserts (or updates the password of) one test login so there's something to
// sign in with right after migrating. Override via env vars, e.g.:
//   SEED_EMAIL=me@company.com SEED_PASSWORD=secret123 npx tsx server/seed.ts
const email = process.env.SEED_EMAIL ?? 'admin@company.com';
const password = process.env.SEED_PASSWORD ?? 'admin123';

async function seed() {
  const passwordHash = await bcrypt.hash(password, 10);

  await pool.query(
    `INSERT INTO login (email, password_hash, is_active)
     VALUES (?, ?, 1)
     ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), is_active = 1`,
    [email, passwordHash]
  );

  console.log(`Seeded login: ${email} / ${password}`);
}

seed()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
