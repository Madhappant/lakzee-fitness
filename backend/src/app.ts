import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import swaggerUi from 'swagger-ui-express';
import swaggerDocument from './swagger.json';
import { errorHandler } from './middlewares/error.middleware';

import authRoutes from './routes/auth.routes';
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

const app: Application = express();
export const prisma = new PrismaClient();

// CORS Allowlist
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
  process.env.CLIENT_URL,
].filter(Boolean) as string[];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || process.env.NODE_ENV !== 'production') {
        return callback(null, true);
      }
      try {
        const reqOrigin = new URL(origin).origin;
        const isAllowed = allowedOrigins.some((o) => {
          try {
            return new URL(o).origin === reqOrigin;
          } catch {
            return false;
          }
        });
        if (isAllowed) {
          return callback(null, true);
        }
      } catch {
        // Invalid Origin header
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);

app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(compression());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

app.use(
  '/uploads',
  express.static(path.join(__dirname, '../uploads'), {
    maxAge: '7d',
    etag: true,
  })
);

// Fast Health & Deep DB Readiness Check
app.get('/health', async (req: Request, res: Response) => {
  if (req.query.deep === '1') {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return res.status(200).json({
        status: 'success',
        message: 'Lakzee Fitness API is running',
        db: 'up',
        uptimeSeconds: Math.round(process.uptime()),
      });
    } catch {
      return res.status(503).json({
        status: 'error',
        message: 'Database unreachable',
        db: 'down',
      });
    }
  }
  return res.status(200).json({
    status: 'success',
    message: 'Lakzee Fitness API is running',
    uptimeSeconds: Math.round(process.uptime()),
  });
});

if (process.env.NODE_ENV !== 'production') {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
}

// Trust reverse proxy (Render, Vercel, Nginx) so client IP is accurately recognized
app.set('trust proxy', 1);

// Rate Limiters
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Too many requests. Please slow down briefly.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Too many authentication attempts. Please try again in 15 minutes.' },
});

const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Too many OTP verification attempts. Please try again in 15 minutes.' },
});

const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Too many AI requests. Please try again in a few minutes.' },
});

const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Too many consultation requests. Please wait before submitting again.' },
});

app.use('/api', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/request-otp', authLimiter);
app.use('/api/auth/request-phone-otp', authLimiter);
app.use('/api/auth/reset-password', otpVerifyLimiter);
app.use('/api/auth/verify-phone', otpVerifyLimiter);
app.use('/api/ai', aiLimiter);
app.use('/api/contact', contactLimiter);

// API Routes
app.use('/api/auth', authRoutes);
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

// Centralized Error Handler
app.use(errorHandler);

export default app;
