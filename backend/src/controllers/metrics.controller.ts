import { Request, Response } from 'express';
import { getDatabasePoolConfig } from '../config/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { asyncHandler } from '../middlewares/error.middleware';
import { analyticsService } from '../services/analytics.service';
import { auditService } from '../services/audit.service';
import { alertManager } from '../utils/alerts';
import { memoryCache } from '../utils/cache';
import { errorTracker } from '../utils/error-tracker';
import { sendSuccess } from '../utils/response';
import { telemetry } from '../utils/telemetry';

export const getObservabilityMetrics = asyncHandler(async (req: AuthRequest, res: Response) => {
  const auditAction = typeof req.query.action === 'string' ? req.query.action : undefined;
  const auditLimit = req.query.limit ? Number(req.query.limit) : 25;
  const branchId = req.tenant?.branchId ?? null;

  const [operationalAnalytics, auditLogs] = await Promise.all([
    analyticsService.getOperationalAnalytics(branchId).catch(() => null),
    auditService.listRecent({ action: auditAction, branchId, limit: auditLimit }).catch(() => []),
  ]);

  const mem = process.memoryUsage();
  const cpu = process.cpuUsage();

  return sendSuccess(res, {
    data: {
      branchId: branchId ?? 'all',
      apm: telemetry.getApmSummary(),
      cache: memoryCache.getStats(),
      pool: getDatabasePoolConfig(),
      system: {
        uptimeSeconds: Math.round(process.uptime()),
        nodeVersion: process.version,
        memory: {
          rssMb: Math.round((mem.rss / 1024 / 1024) * 100) / 100,
          heapUsedMb: Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100,
          heapTotalMb: Math.round((mem.heapTotal / 1024 / 1024) * 100) / 100,
        },
        cpuMs: {
          user: Math.round(cpu.user / 1000),
          system: Math.round(cpu.system / 1000),
        },
      },
      webVitals: telemetry.getWebVitalsSummary(),
      analytics: operationalAnalytics,
      recentErrors: errorTracker.getRecentCapturedErrors(15),
      alerts: alertManager.getRecentAlerts(20),
      auditLogs,
    },
  });
});

export const ingestClientTelemetry = asyncHandler(async (req: Request, res: Response) => {
  const { type, name, value, rating, route, message, stack, componentStack } = req.body;

  if (type === 'web-vital' && name && typeof value === 'number') {
    telemetry.recordClientWebVital({
      name,
      value,
      rating: rating || 'good',
      route: route || '/',
    });
  } else if (type === 'error') {
    telemetry.recordFrontendError();
    const err = new Error(message || 'Unhandled frontend error');
    if (stack) err.stack = String(stack).slice(0, 2000);
    errorTracker.captureException(err, {
      source: 'frontend',
      route: typeof route === 'string' ? route : '/',
      extra: {
        ...(componentStack ? { componentStack: String(componentStack).slice(0, 1000) } : {}),
      },
    });
  }

  return sendSuccess(res, { statusCode: 202, data: { accepted: true } });
});
