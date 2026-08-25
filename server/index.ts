import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { authRouter } from './routes/auth.ts';
import { employeesRouter } from './routes/employees.ts';
import { credentialsRouter } from './routes/credentials.ts';
import { assertDbConnection } from './db.ts';

const app = express();
const port = Number(process.env.PORT ?? 4000);
const corsOrigin = (process.env.CORS_ORIGIN ?? 'http://localhost:3000').split(',').map((o) => o.trim());

app.use(cors({ origin: corsOrigin }));
app.use(express.json());

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

app.listen(port, () => {
  console.log(`API server listening on http://localhost:${port}`);
});
