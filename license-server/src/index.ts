import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import authRoutes from './routes/auth';
import licenseRoutes from './routes/license';
import adminRoutes from './routes/admin';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = Number(process.env.PORT) || 4000;

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

// Health check
app.get('/health', (_req, res) => res.json({ ok: true, service: 'autoservicio-license-server' }));

// Routes
app.use('/api/auth', authRoutes(prisma));
app.use('/api/license', licenseRoutes(prisma));
app.use('/api/admin', adminRoutes(prisma));

// Error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Error interno' });
});

app.listen(PORT, () => {
  console.log(`License server running on port ${PORT}`);
});

export { app, prisma };