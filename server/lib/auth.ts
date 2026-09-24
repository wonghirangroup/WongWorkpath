import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { RowDataPacket } from 'mysql2';
import { pool } from '../db.ts';

// Real session layer. /api/auth/login issues a signed token; every other /api route sits behind
// requireAuth, which trusts nothing the client says about who it is except this token. The token is
// sent as `Authorization: Bearer …` (not a cookie) because the frontend (Vercel) and this API
// (Render) live on different sites — third-party cookies get blocked by Safari and others.

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      // Employee id of the logged-in caller, set by requireAuth. Always prefer this over any id
      // the client puts in the query/body.
      actorId?: string;
    }
  }
}

const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
const RESET_TTL_SECONDS = 10 * 60;

let cachedSecret: Buffer | null = null;
function getSecret(): Buffer {
  if (cachedSecret) return cachedSecret;
  const explicit = process.env.JWT_SECRET;
  if (explicit && explicit.length >= 16) {
    cachedSecret = Buffer.from(explicit, 'utf8');
    return cachedSecret;
  }
  // No JWT_SECRET configured: derive a stable secret from the DB credentials, which only the
  // server knows, so a deploy that forgot the variable still works (and sessions survive
  // restarts) instead of crashing or silently logging everyone out on every Render wake-up.
  const seed = `${process.env.DB_PASSWORD ?? ''}|${process.env.DB_USER ?? ''}|${process.env.DB_HOST ?? ''}`;
  if (seed === '||') {
    console.warn('[auth] Neither JWT_SECRET nor DB credentials are set — using a random secret; sessions will not survive a restart.');
    cachedSecret = crypto.randomBytes(32);
  } else {
    console.warn('[auth] JWT_SECRET is not set — deriving the signing secret from the DB credentials. Set JWT_SECRET (16+ random characters) in the server environment.');
    cachedSecret = crypto.createHmac('sha256', 'wong-workpath-session-v1').update(seed).digest();
  }
  return cachedSecret;
}

interface TokenPayload {
  typ: 'session' | 'reset';
  sub: string;
  iat: number;
  exp: number;
  // Only on reset tokens: the password_reset_otp row this token was minted for.
  otp?: number;
}

const b64 = (input: Buffer | string) => Buffer.from(input).toString('base64url');

function sign(payload: TokenPayload): string {
  const body = b64(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', getSecret()).update(body).digest();
  return `${body}.${b64(sig)}`;
}

function verify(token: string, expectedType: TokenPayload['typ']): TokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expected = crypto.createHmac('sha256', getSecret()).update(body).digest();
  let provided: Buffer;
  try {
    provided = Buffer.from(sig, 'base64url');
  } catch {
    return null;
  }
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as TokenPayload;
    if (payload.typ !== expectedType || typeof payload.sub !== 'string' || !payload.sub) return null;
    if (typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function signSessionToken(employeeId: string): string {
  const now = Math.floor(Date.now() / 1000);
  return sign({ typ: 'session', sub: employeeId, iat: now, exp: now + SESSION_TTL_SECONDS });
}

// Proof that this email just passed /verify-otp — /reset-password refuses to run without it, so
// "someone verified an OTP for this email a minute ago" is no longer enough for anybody to reset.
export function signResetToken(email: string, otpRowId: number): string {
  const now = Math.floor(Date.now() / 1000);
  return sign({ typ: 'reset', sub: email, iat: now, exp: now + RESET_TTL_SECONDS, otp: otpRowId });
}

export function verifyResetToken(token: string, email: string): { otpRowId: number } | null {
  const payload = verify(token, 'reset');
  if (!payload || payload.sub !== email || typeof payload.otp !== 'number') return null;
  return { otpRowId: payload.otp };
}

// A deleted/deactivated account must stop working immediately, not when its token expires a month
// later — but a DB lookup on every request is wasteful, so "still active" is cached briefly.
const ACTIVE_CACHE_MS = 30 * 1000;
const activeCache = new Map<string, number>();

export function forgetActor(employeeId: string): void {
  activeCache.delete(employeeId);
}

async function isActiveAccount(employeeId: string): Promise<boolean> {
  const cachedUntil = activeCache.get(employeeId);
  if (cachedUntil && cachedUntil > Date.now()) return true;
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT 1 FROM login l JOIN employee e ON e.id = l.employee_id WHERE l.employee_id = ? AND l.is_active = 1 LIMIT 1`,
    [employeeId]
  );
  if (rows.length === 0) return false;
  activeCache.set(employeeId, Date.now() + ACTIVE_CACHE_MS);
  return true;
}

function bearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1].trim() : null;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  // CORS preflight carries no credentials by design.
  if (req.method === 'OPTIONS') return next();

  const unauthenticated = () => res.status(401).json({ message: 'กรุณาเข้าสู่ระบบใหม่อีกครั้ง', code: 'UNAUTHENTICATED' });

  const token = bearerToken(req);
  const payload = token ? verify(token, 'session') : null;
  if (!payload) return unauthenticated();

  try {
    if (!(await isActiveAccount(payload.sub))) return unauthenticated();
  } catch (err) {
    return next(err);
  }

  req.actorId = payload.sub;

  // Older client code (and every ownership/permission check written before sessions existed) reads
  // "who is acting" out of these client-supplied fields. Overwrite them with the authenticated id so
  // none of that code can be steered by a forged value — impersonation stops here, in one place.
  req.query.actorEmployeeId = payload.sub;
  const body = req.body;
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    body.actorEmployeeId = payload.sub;
    if ('decidedBy' in body) body.decidedBy = payload.sub;
    if ('requestedBy' in body) body.requestedBy = payload.sub;
  }
  return next();
}
