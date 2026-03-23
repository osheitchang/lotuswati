import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import cors from 'cors';
import { initSocket } from './lib/socket';

// Route imports
import authRoutes from './routes/auth';
import contactRoutes from './routes/contacts';
import conversationRoutes from './routes/conversations';
import templateRoutes from './routes/templates';
import broadcastRoutes from './routes/broadcasts';
import automationRoutes from './routes/automations';
import analyticsRoutes from './routes/analytics';
import teamRoutes from './routes/team';
import webhookRoutes from './routes/webhook';

const app = express();
const httpServer = createServer(app);

// Initialize Socket.io
initSocket(httpServer);

// ─── Middleware ───────────────────────────────────────────────────────────────

// CORS
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Capture raw body for WhatsApp webhook signature verification
// Must be before express.json() for the webhook route
app.use(
  '/webhook',
  express.json({
    verify: (req: Request & { rawBody?: Buffer }, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

// Standard JSON body parser for all other routes
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith('/webhook')) return next();
  express.json({ limit: '10mb' })(req, res, next);
});

app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging in development
if (process.env.NODE_ENV !== 'production') {
  app.use((req: Request, _res: Response, next: NextFunction) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });
}

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use('/api/auth', authRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/broadcasts', broadcastRoutes);
app.use('/api/automations', automationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/team', teamRoutes);
app.use('/', webhookRoutes);

// Health check

// Uncomment this simpler version if you want a more basic health check without version info

// app.get('/health', (_req: Request, res: Response) => {
//   res.json({
//     status: 'ok',
//     timestamp: new Date().toISOString(),
//     env: process.env.NODE_ENV || 'development',
//   });
// });

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    version: '1.0.1',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
  });
});

// API info
app.get('/api', (_req: Request, res: Response) => {
  res.json({
    name: 'LotusWATI Backend API',
    version: '1.0.0',
    endpoints: [
      'POST /api/auth/register',
      'POST /api/auth/login',
      'GET  /api/auth/me',
      'GET  /api/contacts',
      'GET  /api/conversations',
      'GET  /api/templates',
      'GET  /api/broadcasts',
      'GET  /api/automations',
      'GET  /api/analytics/overview',
      'GET  /api/team',
      'GET  /webhook (WA verification)',
      'POST /webhook (WA incoming messages)',
    ],
  });
});

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Server] Unhandled error:', err);
  res.status(500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

// ─── Start Server ─────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT || '3001', 10);

httpServer.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════╗
║          LotusWATI Backend Server                 ║
╠═══════════════════════════════════════════════════╣
║  Status:   Running                                ║
║  Port:     ${PORT}                                   ║
║  Env:      ${(process.env.NODE_ENV || 'development').padEnd(10)}                     ║
║  DB:       ${(process.env.DATABASE_URL || 'file:./dev.db').padEnd(10)}              ║
╚═══════════════════════════════════════════════════╝
  `);
  console.log(`API:     http://localhost:${PORT}/api`);
  console.log(`Health:  http://localhost:${PORT}/health`);
  console.log(`Webhook: http://localhost:${PORT}/webhook`);
});

export default app;
