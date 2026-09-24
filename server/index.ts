import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { authRouter } from './routes/auth.ts';
import { employeesRouter } from './routes/employees.ts';
import { credentialsRouter } from './routes/credentials.ts';
import { projectsRouter } from './routes/projects.ts';
import { meetingsRouter } from './routes/meetings.ts';
import { projectTasksRouter } from './routes/project-tasks.ts';
import { projectCustomStatusesRouter } from './routes/project-custom-statuses.ts';
import { projectCustomTypesRouter } from './routes/project-custom-types.ts';
import { notificationsRouter } from './routes/notifications.ts';
import { changeRequestsRouter } from './routes/change-requests.ts';
import { documentsRouter } from './routes/documents.ts';
import { orgStructureRouter } from './routes/org-structure.ts';
import { auditLogsRouter } from './routes/audit-logs.ts';
import { deadlineRemindersRouter } from './routes/deadline-reminders.ts';
import { assertDbConnection } from './db.ts';
import { requireAuth } from './lib/auth.ts';

const app = express();
const port = Number(process.env.PORT ?? 4000);
const corsOrigin = (process.env.CORS_ORIGIN ?? 'http://localhost:3000').split(',').map((o) => o.trim());

// Render (and most hosts) put a reverse proxy in front — without this every request appears to come
// from the proxy's own IP, which would make the login rate limiter lock out everybody at once.
app.set('trust proxy', 1);
app.use(cors({ origin: corsOrigin }));
// Raised from 2mb to cover Doc Vault's own 3MB raw-file cap (MAX_FILE_BYTES in DocVault.tsx) once
// base64-encoded (~37% inflation, so ~4.1mb) plus the rest of the JSON payload — 2mb was already
// tight for an avatar upload and would silently reject a near-cap file attachment.
app.use(express.json({ limit: '6mb' }));

app.get('/api/health', async (_req, res) => {
  try {
    await assertDbConnection();
    res.json({ status: 'ok', db: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'error', db: 'unreachable', message: (err as Error).message });
  }
});

// /api/auth carries its own public endpoints (login, forgot/verify/reset) — everything registered
// after the requireAuth line below needs a valid session token.
app.use('/api/auth', authRouter);
app.use('/api', requireAuth);
app.use('/api/employees', employeesRouter);
app.use('/api/credentials', credentialsRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/meetings', meetingsRouter);
app.use('/api/project-tasks', projectTasksRouter);
app.use('/api/project-custom-statuses', projectCustomStatusesRouter);
app.use('/api/project-custom-types', projectCustomTypesRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/change-requests', changeRequestsRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/org-structure', orgStructureRouter);
app.use('/api/audit-logs', auditLogsRouter);
app.use('/api/deadline-reminders', deadlineRemindersRouter);

// Last resort for anything a route didn't catch itself (Express 4 never forwards a rejected async
// handler here on its own, but a sync throw or an explicit next(err) lands in this).
app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(`${req.method} ${req.originalUrl} failed:`, err);
  if (res.headersSent) return next(err);
  const status = typeof (err as { status?: number })?.status === 'number' ? (err as { status: number }).status : 500;
  const message =
    status === 413 ? 'ข้อมูลที่ส่งมีขนาดใหญ่เกินไป' : status === 400 ? 'ข้อมูลที่ส่งมาไม่ถูกต้อง' : 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง';
  res.status(status).json({ message });
});

// A single stray rejection (e.g. a DB connection dropping mid-query inside a handler without its
// own try/catch) would otherwise take the whole API down on newer Node versions.
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});

app.listen(port, () => {
  console.log(`API server listening on http://localhost:${port}`);
});
