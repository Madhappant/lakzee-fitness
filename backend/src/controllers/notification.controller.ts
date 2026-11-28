import crypto from 'crypto';
import { Request, Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { asyncHandler } from '../middlewares/error.middleware';
import { analyticsService } from '../services/analytics.service';
import { auditService } from '../services/audit.service';
import { notificationService } from '../services/notification.service';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';
import { sendSuccess } from '../utils/response';

function verifyCronSecretHeader(providedHeader: unknown): void {
  const configuredSecret = process.env.CRON_SECRET?.trim();
  if (!configuredSecret) {
    throw new ForbiddenError('Cron endpoint is disabled (CRON_SECRET is not configured)', 'CRON_DISABLED');
  }
  if (typeof providedHeader !== 'string' || !providedHeader.trim()) {
    throw new UnauthorizedError('Missing X-Cron-Secret header', 'CRON_UNAUTHORIZED');
  }

  const provided = Buffer.from(providedHeader.trim(), 'utf8');
  const expected = Buffer.from(configuredSecret, 'utf8');
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    throw new ForbiddenError('Invalid X-Cron-Secret credential', 'CRON_FORBIDDEN');
  }
}

export const getNotifications = asyncHandler(async (req: AuthRequest, res: Response) => {
  const branchId = req.tenant?.branchId ?? req.user?.branchId ?? null;
  const notifications = await analyticsService.getNotificationsFeed(
    req.user!.id,
    req.user!.role,
    req.query.tzOffset,
    branchId
  );
  return sendSuccess(res, {
    data: notifications,
    meta: { total: notifications.length, branchId: branchId ?? 'all' },
  });
});

export const getNotificationLogs = asyncHandler(async (req: AuthRequest, res: Response) => {
  const querySource = req.validated?.query ?? req.query;
  const branchId = req.tenant?.branchId ?? null;
  const logs = await notificationService.listLogs({
    branchId,
    status: typeof querySource.status === 'string' ? querySource.status : undefined,
    channel: typeof querySource.channel === 'string' ? querySource.channel : undefined,
    limit: querySource.limit ? Number(querySource.limit) : 50,
  });

  return sendSuccess(res, {
    data: logs,
    meta: { total: logs.length, branchId: branchId ?? 'all' },
  });
});

export const sendManualNotification = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await notificationService.sendManualReminder({
    memberId: req.body.memberId,
    channels: req.body.channels,
    milestone: req.body.milestone,
    dryRun: req.body.dryRun,
    tenant: req.tenant,
  });

  auditService.record({
    branchId: result.branchId,
    actorId: req.user?.id,
    actorRole: req.user?.role,
    action: 'REMINDER_SENT',
    targetId: result.memberId,
    ipAddress: req.ip,
    description: `Manual expiry reminder triggered for #${result.memberCode} (${result.memberName})`,
    metadata: { dryRun: result.dryRun, channels: result.results.map((r) => `${r.channel}:${r.status}`) },
  });

  return sendSuccess(res, { data: result });
});

export const retryNotificationLog = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await notificationService.retryFailedLog({
    logId: req.params.id as string,
    tenant: req.tenant,
    dryRun: req.body?.dryRun,
  });

  auditService.record({
    branchId: result.branchId,
    actorId: req.user?.id,
    actorRole: req.user?.role,
    action: 'REMINDER_SENT',
    targetId: result.logId,
    ipAddress: req.ip,
    description: `Retried failed ${result.channel} reminder (${result.status})`,
    metadata: { milestone: result.milestone, dryRun: result.dryRun },
  });

  return sendSuccess(res, { data: result });
});

export const runRemindersNow = asyncHandler(async (req: AuthRequest, res: Response) => {
  const branchId = req.tenant?.branchId ?? null;
  const summary = await notificationService.runExpiryReminderBatch({
    branchId,
    dryRun: req.body?.dryRun,
  });

  auditService.record({
    branchId: branchId ?? undefined,
    actorId: req.user?.id,
    actorRole: req.user?.role,
    action: 'REMINDER_BATCH_RUN',
    ipAddress: req.ip,
    description: `Executed manual expiry reminder sweep (sent=${summary.sent}, failed=${summary.failed})`,
    metadata: { dryRun: summary.dryRun, matchedMilestones: summary.matchedMilestones },
  });

  return sendSuccess(res, { data: summary });
});

export const triggerExpiryCronJob = asyncHandler(async (req: Request, res: Response) => {
  verifyCronSecretHeader(req.headers['x-cron-secret']);

  const summary = await notificationService.runExpiryReminderBatch({
    branchId: typeof req.body?.branchId === 'string' && req.body.branchId.trim() ? req.body.branchId.trim() : null,
    dryRun: typeof req.body?.dryRun === 'boolean' ? req.body.dryRun : undefined,
  });

  auditService.record({
    actorRole: 'SYSTEM_CRON',
    action: 'REMINDER_BATCH_RUN',
    ipAddress: req.ip,
    description: `Cron expiry reminder sweep finished (sent=${summary.sent}, failed=${summary.failed})`,
    metadata: { dryRun: summary.dryRun, targetDate: summary.targetDate },
  });

  return sendSuccess(res, { data: summary });
});
