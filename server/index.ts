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
import { assertDbConnection } from './db.ts';

const app = express();
const port = Number(process.env.PORT ?? 4000);
const corsOrigin = (process.env.CORS_ORIGIN ?? 'http://localhost:3000').split(',').map((o) => o.trim());

app.use(cors({ origin: corsOrigin }));
// Default 100kb is well under a base64-encoded avatar upload (500kb raw file * ~1.37 base64
// overhead) — raised with headroom so those requests don't get silently dropped mid-transfer.
app.use(express.json({ limit: '2mb' }));

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

app.listen(port, () => {
  console.log(`API server listening on http://localhost:${port}`);
});
