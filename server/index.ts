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
import { notificationsRouter } from './routes/notifications.ts';
import { changeRequestsRouter } from './routes/change-requests.ts';
import { documentsRouter } from './routes/documents.ts';
import { orgStructureRouter } from './routes/org-structure.ts';
import { auditLogsRouter } from './routes/audit-logs.ts';
import { assertDbConnection } from './db.ts';

const app = express();
const port = Number(process.env.PORT ?? 4000);
const corsOrigin = (process.env.CORS_ORIGIN ?? 'http://localhost:3000').split(',').map((o) => o.trim());

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

app.use('/api/auth', authRouter);
app.use('/api/employees', employeesRouter);
app.use('/api/credentials', credentialsRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/meetings', meetingsRouter);
app.use('/api/project-tasks', projectTasksRouter);
app.use('/api/project-custom-statuses', projectCustomStatusesRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/change-requests', changeRequestsRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/org-structure', orgStructureRouter);
app.use('/api/audit-logs', auditLogsRouter);

app.listen(port, () => {
  console.log(`API server listening on http://localhost:${port}`);
});
