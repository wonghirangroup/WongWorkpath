import 'dotenv/config';
import { INITIAL_CREDENTIALS } from '../src/data/mockData.ts';
import { pool } from './db.ts';

// Upserts the app's existing mock credential vault into the `credential` table,
// same pattern as seed-employees.ts.
async function seedCredentials() {
  for (const c of INITIAL_CREDENTIALS) {
    await pool.query(
      `INSERT INTO credential
         (id, label, type, scope, team, username, password, key_value, notes, url, logo_url, last_viewed_at, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         label = VALUES(label),
         type = VALUES(type),
         scope = VALUES(scope),
         team = VALUES(team),
         username = VALUES(username),
         password = VALUES(password),
         key_value = VALUES(key_value),
         notes = VALUES(notes),
         url = VALUES(url),
         logo_url = VALUES(logo_url),
         last_viewed_at = VALUES(last_viewed_at),
         created_by = VALUES(created_by),
         created_at = VALUES(created_at)`,
      [
        c.id, c.label, c.type, c.scope, c.team ?? null,
        c.username, c.password ?? null, c.keyValue ?? null, c.notes ?? null,
        c.url ?? null, c.logoUrl ?? null, c.lastViewedAt ?? null, c.createdBy, c.createdAt,
      ]
    );
  }

  console.log(`Seeded ${INITIAL_CREDENTIALS.length} credentials.`);
}

seedCredentials()
  .catch((err) => {
    console.error('Credential seed failed:', err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
