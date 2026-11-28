import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import swaggerDocument from './swagger.json';
import { prisma, getDatabasePoolConfig } from './config/prisma';
import { isAllowedOrigin, securityEnv } from './config/env';
import { isServerDraining } from './config/lifecycle';
import { apmMiddleware } from './middlewares/apm.middleware';
import { errorHandler } from './middlewares/error.middleware';
import { sanitizeInputs } from './middlewares/sanitize.middleware';
import { memoryCache } from './utils/cache';
import { NotFoundError } from './utils/errors';
import { logger } from './utils/logger';
import { HybridRateLimitStore } from './utils/rate-limit-store';
import { telemetry } from './utils/telemetry';

import authRoutes from './routes/auth.routes';
import branchRoutes from './routes/branch.routes';
import memberRoutes from './routes/member.routes';
import planRoutes from './routes/plan.routes';
import subscriptionRoutes from './routes/subscription.routes';
import attendanceRoutes from './routes/attendance.routes';
import settingsRoutes from './routes/settings.routes';
import dashboardRoutes from './routes/dashboard.routes';
import staffRoutes from './routes/staff.routes';
import reportsRoutes from './routes/reports.routes';
import portalRoutes from './routes/portal.routes';
import dietWorkoutRoutes from './routes/diet-workout.routes';
import notificationRoutes from './routes/notification.routes';
import announcementRoutes from './routes/announcement.routes';
import expenseRoutes from './routes/expense.routes';
import aiRoutes from './routes/ai.routes';
import contactRoutes from './routes/contact.routes';
import metricsRoutes from './routes/metrics.routes';
import telemetryRoutes from './routes/telemetry.routes';
import cronRoutes from './routes/cron.routes';
import paymentRoutes from './routes/payment.routes';

const app: Application = express();
export { prisma };

// Strict CORS Allowlist — never wildcard `*` in production
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin && !securityEnv.isProduction) {
        return callback(null, true);
      }
      if (!origin && securityEnv.isProduction) {
        // Server-to-server health pings / cron jobs do not send Origin headers
        return callback(null, true);
      }
      if (isAllowedOrigin(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Branch-Id', 'X-Cron-Secret'],
  })
);

app.disable('x-powered-by');
app.use(
  helmet({
    crossOriginResourcePolicy: false,
    frameguard: { action: 'deny' },
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hsts: securityEnv.isProduction
      ? { maxAge: 31536000, includeSubDomains: true, preload: true }
      : false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'none'"],
      },
    },
  })
);
app.use(compression());
app.use(apmMiddleware);
if (securityEnv.isProduction) {
  app.use((req, res, next) => {
    const startMs = Date.now();
    res.on('finish', () => {
      if (req.path === '/health' || req.path === '/api/health') return;
      logger.info('http_request', {
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: Date.now() - startMs,
        ip: req.ip,
      });
    });
    next();
  });
} else {
  app.use(morgan('dev'));
}

// Tight payload limits prevent DoS floods; AI endpoints allow larger multi-turn payloads separately
app.use('/api/ai', express.json({ limit: '512kb' }));
app.use(
  express.json({
    limit: '100kb',
    verify: (req, _res, buf) => {
      (req as Request).rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// Global input sanitization against prototype pollution, NoSQL/JSON operators, & XSS strings
app.use(sanitizeInputs);

app.use(
  '/uploads',
  express.static(path.join(__dirname, '../uploads'), {
    maxAge: '7d',
    etag: true,
  })
);

// Fast Health & 24/7 Keep-Alive Endpoints (exempt from rate limiting)
async function handleHealthCheck(req: Request, res: Response, forceDbPing: boolean) {
  res.setHeader('Cache-Control', 'no-store');

  if (isServerDraining()) {
    return res.status(503).json({
      success: false,
      status: 'draining',
      message: 'Server is draining for deployment shutdown',
      timestamp: new Date().toISOString(),
    });
  }

  const shouldPingDb = (forceDbPing && req.query.shallow !== '1') || req.query.deep === '1';

  const cacheStats = memoryCache.getStats();
  const memoryMb = Math.round((process.memoryUsage().rss / 1024 / 1024) * 100) / 100;

  if (shouldPingDb) {
    const dbStartNs = process.hrtime.bigint();
    try {
      await prisma.$queryRaw`SELECT 1`;
      const dbLatencyMs = Math.round((Number(process.hrtime.bigint() - dbStartNs) / 1_000_000) * 100) / 100;
      return res.status(200).json({
        success: true,
        status: 'success',
        message: 'Lakzee Fitness API is running',
        db: 'up',
        dbLatencyMs,
        cacheHitRate: cacheStats.hitRatePercent,
        redis: cacheStats.distributed,
        pool: getDatabasePoolConfig(),
        memoryMb,
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.round(process.uptime()),
      });
    } catch (err) {
      telemetry.recordHealthFailure(err instanceof Error ? err.message : 'Database unreachable');
      return res.status(503).json({
        success: false,
        status: 'error',
        message: 'Database unreachable',
        db: 'down',
        memoryMb,
        timestamp: new Date().toISOString(),
      });
    }
  }

  return res.status(200).json({
    success: true,
    status: 'success',
    message: 'Lakzee Fitness API is running',
    cacheHitRate: cacheStats.hitRatePercent,
    memoryMb,
    uptimeSeconds: Math.round(process.uptime()),
  });
}

app.get('/health', (req: Request, res: Response) => handleHealthCheck(req, res, false));
app.get('/api/health', (req: Request, res: Response) => handleHealthCheck(req, res, true));

if (!securityEnv.isProduction) {
  app.use(
    '/api-docs',
    (_req, res, next) => {
      res.removeHeader('Content-Security-Policy');
      next();
    },
    swaggerUi.serve,
    swaggerUi.setup(swaggerDocument)
  );
}

// Trust reverse proxy (Render, Vercel, Nginx) so client IP is accurately recognized
app.set('trust proxy', 1);

const rateLimitMessage = (message: string) => ({
  success: false,
  status: 'error',
  code: 'RATE_LIMITED',
  message,
});

// Rate Limiters (Redis-backed when configured; resilient per-store memory fallback otherwise)
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  store: new HybridRateLimitStore('rl:api:'),
  message: rateLimitMessage('Too many requests. Please slow down briefly.'),
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: new HybridRateLimitStore('rl:auth:'),
  message: rateLimitMessage('Too many authentication attempts. Please try again in 15 minutes.'),
});

const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  store: new HybridRateLimitStore('rl:refresh:'),
  message: rateLimitMessage('Too many token refresh requests. Please slow down.'),
});

const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  store: new HybridRateLimitStore('rl:otp:'),
  message: rateLimitMessage('Too many OTP verification attempts. Please try again in 15 minutes.'),
});

const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  store: new HybridRateLimitStore('rl:ai:'),
  message: rateLimitMessage('Too many AI requests. Please try again in a few minutes.'),
});

const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: new HybridRateLimitStore('rl:contact:'),
  message: rateLimitMessage('Too many consultation requests. Please wait before submitting again.'),
});

const telemetryLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  store: new HybridRateLimitStore('rl:telemetry:'),
  message: rateLimitMessage('Too many telemetry beacons.'),
});

app.use('/api', apiLimiter);
app.use('/api/telemetry', telemetryLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/request-otp', authLimiter);
app.use('/api/auth/request-phone-otp', authLimiter);
app.use('/api/auth/reset-password', otpVerifyLimiter);
app.use('/api/auth/verify-phone', otpVerifyLimiter);
app.use('/api/auth/refresh', refreshLimiter);
app.use('/api/ai', aiLimiter);
app.use('/api/contact', contactLimiter);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/portal', portalRoutes);
app.use('/api/plans-routines', dietWorkoutRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/metrics', metricsRoutes);
app.use('/api/telemetry', telemetryRoutes);
app.use('/api/cron', cronRoutes);
app.use('/api/payments', paymentRoutes);

// Standardized 404 JSON envelope for unmatched routes
app.use((_req: Request, _res: Response, next) => {
  next(new NotFoundError('Route not found'));
});

// Centralized Error Handler
app.use(errorHandler);

export default app;
