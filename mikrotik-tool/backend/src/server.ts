import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import http from 'http';

import { initWebSocket } from './websocket/ws-server';
import { handleLogin, authMiddleware } from './middleware/auth';
import connectRouter from './routes/connect';
import devicesRouter from './routes/devices';
import configRouter from './routes/config';
import applyRouter from './routes/apply';
import changelogRouter from './routes/changelog';
import dashboardRouter from './routes/dashboard';
import backupRouter from './routes/backup';

const app = express();
const PORT = parseInt(process.env.PORT || '3001');

// ─── Middleware ────────────────────────────────────────────────────────────────

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// General rate limiter
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  message: { success: false, error: 'Too many requests' },
});
app.use(generalLimiter);

// Auth rate limiter
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, error: 'Too many auth attempts' },
});

// ─── Auth ──────────────────────────────────────────────────────────────────────

app.post('/api/auth/login', authLimiter, handleLogin);

// ─── Health check (public) ────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({ success: true, status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Protected routes ─────────────────────────────────────────────────────────

// Temporarily allow unauthenticated access in development
const useAuth = process.env.NODE_ENV === 'production' ? authMiddleware : (_req: express.Request, _res: express.Response, next: express.NextFunction) => next();

app.use('/api/connect', useAuth, connectRouter);
app.use('/api/devices', useAuth, devicesRouter);
app.use('/api/config', useAuth, configRouter);
app.use('/api/apply', useAuth, applyRouter);
app.use('/api/changelog', useAuth, changelogRouter);
app.use('/api/dashboard', useAuth, dashboardRouter);
app.use('/api/backup', useAuth, backupRouter);

// ─── Error handler ─────────────────────────────────────────────────────────────

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ success: false, error: err.message || 'Internal server error' });
});

// ─── Start ─────────────────────────────────────────────────────────────────────

const server = http.createServer(app);

server.listen(PORT, () => {
  console.log(`MikroTik Tool API running on http://localhost:${PORT}`);
});

initWebSocket(server);

export default app;
