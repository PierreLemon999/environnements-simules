import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import path from 'path';
import { fileURLToPath } from 'url';
import { dataDir } from './db/index.js';

// Route imports
import authRoutes from './routes/auth.js';
import projectRoutes from './routes/projects.js';
import versionRoutes from './routes/versions.js';
import pageRoutes from './routes/pages.js';
import demoRoutes from './routes/demo.js';
import obfuscationRoutes from './routes/obfuscation.js';
import assignmentRoutes from './routes/assignments.js';
import analyticsRoutes from './routes/analytics.js';
import updateRequestRoutes from './routes/update-requests.js';
import captureJobRoutes from './routes/capture-jobs.js';
import transitionRoutes from './routes/transitions.js';
import userRoutes from './routes/users.js';
import settingsRoutes from './routes/settings.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.BACKEND_PORT || '3001', 10);

// ── Global Middleware ────────────────────────────────────────────────────────

// CORS: allow frontend dev server (any localhost port in dev)
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const allowed = [
        'https://env-ll.com',
        'https://getlemonlab.com',
        process.env.FRONTEND_URL || '',
      ].filter(Boolean);
      if (allowed.includes(origin) || /^http:\/\/localhost:\d+$/.test(origin) || /^chrome-extension:\/\//.test(origin)) {
        return callback(null, true);
      }
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);

// Security headers (relaxed for demo serving)
app.use(
  helmet({
    contentSecurityPolicy: false, // Disabled because we serve captured HTML pages
    crossOriginEmbedderPolicy: false,
  })
);

// Logging
app.use(morgan('dev'));

// Compression
app.use(compression());

// JSON body parser with 50 MB limit for page uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static file serving for uploads
app.use('/uploads', express.static(path.join(dataDir, 'uploads')));

// ── API Routes ───────────────────────────────────────────────────────────────

app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api', versionRoutes); // Handles /api/projects/:projectId/versions and /api/versions/:id
app.use('/api', pageRoutes); // Handles /api/versions/:versionId/pages, /api/pages/:id, etc.
app.use('/api', obfuscationRoutes); // Handles /api/projects/:projectId/obfuscation and /api/obfuscation/:id
app.use('/api', assignmentRoutes); // Handles /api/versions/:versionId/assignments and /api/assignments/:id
app.use('/api/analytics', analyticsRoutes);
app.use('/api', updateRequestRoutes); // Handles /api/pages/:pageId/update-request and /api/update-requests
app.use('/api', captureJobRoutes); // Handles /api/versions/:versionId/capture-jobs and /api/capture-jobs/:id
app.use('/api', transitionRoutes); // Handles /api/versions/:versionId/transitions, /api/pages/:pageId/transitions, /api/transitions/:id
app.use('/api/users', userRoutes);
app.use('/api/settings', settingsRoutes);

// ── Demo Serving Route ───────────────────────────────────────────────────────

app.use('/demo', demoRoutes);

// ── Health Check ─────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    },
  });
});

// ── 404 Handler ──────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found', code: 404 });
});

// ── Global Error Handler ─────────────────────────────────────────────────────

app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
      error: process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : err.message,
      code: 500,
    });
  }
);

// ── Start Server ─────────────────────────────────────────────────────────────

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Backend server running on http://127.0.0.1:${PORT}`);
  console.log(`API available at http://127.0.0.1:${PORT}/api`);
  console.log(`Demo serving at http://127.0.0.1:${PORT}/demo/:subdomain/*`);
});

export default app;
