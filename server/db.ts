import 'dotenv/config';
import mysql from 'mysql2/promise';
import type { PoolConnection } from 'mysql2/promise';

// Single shared connection pool for the whole backend. mysql2's pool handles
// reconnection/queuing on its own, so every route should import `pool` rather
// than opening its own connection.
//
// keepAlive + a short idleTimeout matter on Render's free plan: the host and the remote MySQL both
// drop quiet sockets, and a pooled connection that died while idle used to surface as an
// ECONNRESET 500 on whichever request happened to pick it up next. Idle connections are now
// recycled well before the network gets a chance to kill them.
export const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  maxIdle: 3,
  idleTimeout: 20_000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10_000,
  queueLimit: 0,
  dateStrings: true,
});

const TRANSIENT_CODES = new Set(['ECONNRESET', 'EPIPE', 'PROTOCOL_CONNECTION_LOST', 'ETIMEDOUT']);

function isTransientConnectionError(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code;
  return typeof code === 'string' && TRANSIENT_CODES.has(code);
}

function isReadOnlyStatement(sql: unknown): boolean {
  const text = typeof sql === 'string' ? sql : (sql as { sql?: string } | null)?.sql;
  return typeof text === 'string' && /^\s*(select|show)\b/i.test(text);
}

// A SELECT is safe to run twice, so if the pooled connection it landed on turns out to be dead, try
// once more on a fresh one instead of failing the request. Writes are deliberately not retried —
// if the first attempt actually reached the server a second one could apply the change twice.
const rawQuery = pool.query.bind(pool) as (...args: unknown[]) => Promise<unknown>;
pool.query = (async (...args: unknown[]) => {
  try {
    return await rawQuery(...args);
  } catch (err) {
    if (isTransientConnectionError(err) && isReadOnlyStatement(args[0])) return rawQuery(...args);
    throw err;
  }
}) as typeof pool.query;

// Runs `work` on a single connection inside a transaction — committed if it resolves, rolled back if
// it throws. For multi-statement changes that must not be left half-applied.
export async function withTransaction<T>(work: (conn: PoolConnection) => Promise<T>): Promise<T> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await work(conn);
    await conn.commit();
    return result;
  } catch (err) {
    try {
      await conn.rollback();
    } catch {
      /* the connection itself is gone — nothing left to roll back */
    }
    throw err;
  } finally {
    conn.release();
  }
}

export async function assertDbConnection(): Promise<void> {
  const conn = await pool.getConnection();
  try {
    await conn.ping();
  } finally {
    conn.release();
  }
}
