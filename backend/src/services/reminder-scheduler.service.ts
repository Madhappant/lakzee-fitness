import { logger } from '../utils/logger';
import { notificationService } from './notification.service';

let scheduledTimer: ReturnType<typeof setTimeout> | null = null;
let lastRunDateKey: string | null = null;
let schedulerRunning = false;

/**
 * Computes delay in milliseconds until the next `hour:minute` in the target IANA timeZone.
 */
export function computeNextRunDelayMs(
  now = new Date(),
  hour = Number(process.env.REMINDER_CRON_HOUR ?? 9),
  minute = Number(process.env.REMINDER_CRON_MINUTE ?? 0),
  timeZone = process.env.REMINDER_TIMEZONE || 'Asia/Kolkata'
): number {
  const safeHour = Math.min(23, Math.max(0, Number.isFinite(hour) ? hour : 9));
  const safeMinute = Math.min(59, Math.max(0, Number.isFinite(minute) ? minute : 0));

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const currentHour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0) % 24;
  const currentMinute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  const currentSecond = Number(parts.find((p) => p.type === 'second')?.value ?? 0);

  const nowSecondsOfDay = currentHour * 3600 + currentMinute * 60 + currentSecond;
  const targetSecondsOfDay = safeHour * 3600 + safeMinute * 60;

  let deltaSeconds = targetSecondsOfDay - nowSecondsOfDay;
  if (deltaSeconds <= 30) {
    deltaSeconds += 24 * 3600;
  }
  return deltaSeconds * 1000;
}

async function runScheduledTick() {
  const timeZone = process.env.REMINDER_TIMEZONE || 'Asia/Kolkata';
  const todayKey = new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date());

  if (lastRunDateKey === todayKey) {
    return;
  }
  lastRunDateKey = todayKey;

  try {
    const summary = await notificationService.runExpiryReminderBatch({ timeZone });
    logger.info('Automated daily expiry reminder batch finished', {
      dryRun: summary.dryRun,
      targetDate: summary.targetDate,
      evaluatedMembers: summary.evaluatedMembers,
      matchedMilestones: summary.matchedMilestones,
      sent: summary.sent,
      failed: summary.failed,
      skippedDuplicate: summary.skippedDuplicate,
      skippedOptOut: summary.skippedOptOut,
    });
  } catch (err) {
    logger.error('Automated expiry reminder batch failed', {
      reason: err instanceof Error ? err.message : 'unknown error',
    });
  }
}

export function startReminderScheduler(): void {
  const enabled = String(process.env.REMINDER_CRON_ENABLED ?? 'true').toLowerCase() !== 'false';
  if (!enabled || process.env.NODE_ENV === 'test' || schedulerRunning) {
    return;
  }
  schedulerRunning = true;

  const scheduleNext = () => {
    if (!schedulerRunning) return;
    const delayMs = computeNextRunDelayMs();
    scheduledTimer = setTimeout(() => {
      void runScheduledTick().finally(() => {
        if (schedulerRunning) {
          scheduleNext();
        }
      });
    }, delayMs);
    scheduledTimer.unref();

    logger.info('Scheduled daily expiry reminder tick', {
      timeZone: process.env.REMINDER_TIMEZONE || 'Asia/Kolkata',
      hour: Number(process.env.REMINDER_CRON_HOUR ?? 9),
      minute: Number(process.env.REMINDER_CRON_MINUTE ?? 0),
      nextRunInMinutes: Math.round(delayMs / 60000),
    });
  };

  scheduleNext();
}

export function stopReminderScheduler(): void {
  schedulerRunning = false;
  if (scheduledTimer) {
    clearTimeout(scheduledTimer);
    scheduledTimer = null;
  }
}
