import 'dotenv/config';
import { readdir, readFile } from 'fs/promises';
import path from 'path';
import { pool } from './db.ts';

// Error codes that mean "this piece of schema is already there" — safe to
// skip so re-running a file (e.g. its ALTER TABLE after its CREATE TABLE
// succeeded before) doesn't abort the whole migration.
const ALREADY_EXISTS_ERRNOS = new Set([
  1050, // ER_TABLE_EXISTS_ERROR
  1061, // ER_DUP_KEYNAME
  1826, // ER_FK_DUP_NAME
]);

// Minimal migration runner: executes every server/sql/*.sql file in filename
// order, splitting each file on `;` so files can carry more than one
// statement (e.g. CREATE TABLE followed by an ALTER TABLE ... ADD CONSTRAINT).
// No migrations-ran ledger table yet — fine while there are only a couple of files.
async function migrate() {
  const sqlDir = path.resolve(import.meta.dirname, 'sql');
  const files = (await readdir(sqlDir)).filter((f) => f.endsWith('.sql')).sort();

  if (files.length === 0) {
    console.log('No .sql files found in server/sql — nothing to do.');
    return;
  }

  for (const file of files) {
    const filePath = path.join(sqlDir, file);
    const raw = await readFile(filePath, 'utf-8');
    const statements = raw
      .split(';')
      .map((s) =>
        s
          .split('\n')
          .filter((line) => !line.trim().startsWith('--'))
          .join('\n')
          .trim()
      )
      .filter((s) => s.length > 0);

    console.log(`Running ${file}...`);
    for (const statement of statements) {
      try {
        await pool.query(statement);
      } catch (err) {
        const errno = (err as { errno?: number }).errno;
        if (errno && ALREADY_EXISTS_ERRNOS.has(errno)) {
          console.log(`  skipped (already applied): ${statement.split('\n')[0]}...`);
          continue;
        }
        throw err;
      }
    }
    console.log(`  done.`);
  }

  console.log('Migration complete.');
}

migrate()
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
