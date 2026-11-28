/* eslint-disable @typescript-eslint/no-explicit-any */
import { NotificationRepository, notificationRepository } from '../repositories/notification.repository';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { logger } from '../utils/logger';
import {
  assertBranchOwnership,
  PRIMARY_BRANCH_ID,
  PRIMARY_BRANCH_NAME,
  type TenantScope,
} from '../utils/tenant';
import { normalizeE164Phone } from './notifications/e164';
import { createEmailAdapter } from './notifications/email.adapter';
import {
  type EmailProviderAdapter,
  type NotificationChannel,
  type PaymentConfirmationContext,
  type ReminderMilestone,
  type ReminderTemplateContext,
  type WhatsAppProviderAdapter,
  MILESTONE_DAYS_MAP,
} from './notifications/messaging.types';
import { createWhatsAppAdapter } from './notifications/whatsapp.adapter';
import { buildRenewalUrl, createRenewalLinkToken } from './payments/renewal-token';

export interface ReminderBatchOptions {
  now?: Date;
  timeZone?: string;
  branchId?: string | null;
  dryRun?: boolean;
  batchSize?: number;
  batchDelayMs?: number;
  whatsappAdapter?: WhatsAppProviderAdapter;
  emailAdapter?: EmailProviderAdapter;
}

export interface ReminderBatchSummary {
  dryRun: boolean;
  timeZone: string;
  targetDate: string;
  evaluatedMembers: number;
  matchedMilestones: number;
  sent: number;
  failed: number;
  skippedDuplicate: number;
  skippedOptOut: number;
  skippedChannelDisabled: number;
  details: Array<{
    memberId: string;
    memberCode: string;
    branchId: string;
    channel: NotificationChannel;
    milestone: ReminderMilestone;
    status: 'SENT' | 'FAILED' | 'SKIPPED';
    reason?: string;
    providerMessageId?: string | null;
  }>;
}

export function getCalendarDayPartsInTz(
  date: Date,
  timeZone = process.env.REMINDER_TIMEZONE || 'Asia/Kolkata'
): { year: number; month: number; day: number; isoDate: string; dayIndex: number } {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const year = Number(parts.find((p) => p.type === 'year')?.value ?? date.getUTCFullYear());
  const month = Number(parts.find((p) => p.type === 'month')?.value ?? date.getUTCMonth() + 1);
  const day = Number(parts.find((p) => p.type === 'day')?.value ?? date.getUTCDate());
  const isoDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const dayIndex = Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
  return { year, month, day, isoDate, dayIndex };
}

export function computeDaysUntilExpiry(
  expiryDate: Date,
  referenceNow: Date,
  timeZone = process.env.REMINDER_TIMEZONE || 'Asia/Kolkata'
): { daysLeft: number; cycleExpiryDate: Date; expiryFormatted: string } {
  const nowParts = getCalendarDayPartsInTz(referenceNow, timeZone);
  const expParts = getCalendarDayPartsInTz(expiryDate, timeZone);
  const daysLeft = expParts.dayIndex - nowParts.dayIndex;
  const cycleExpiryDate = new Date(Date.UTC(expParts.year, expParts.month - 1, expParts.day, 0, 0, 0, 0));
  const expiryFormatted = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'UTC',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(cycleExpiryDate);
  return { daysLeft, cycleExpiryDate, expiryFormatted };
}

export function parseActiveMilestones(raw?: string | null): Set<number> {
  if (!raw || !raw.trim()) return new Set([7, 3, 1, 0]);
  const parsed = raw
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((num) => Number.isInteger(num) && num in MILESTONE_DAYS_MAP);
  return parsed.length > 0 ? new Set(parsed) : new Set([7, 3, 1, 0]);
}

function isDryRunEnvEnabled(explicitDryRun?: boolean): boolean {
  if (typeof explicitDryRun === 'boolean') return explicitDryRun;
  return String(process.env.DRY_RUN || '').trim().toLowerCase() === 'true';
}

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export class NotificationService {
  constructor(private readonly repo: NotificationRepository = notificationRepository) {}

  private buildTemplateContext(params: {
    profile: any;
    user: any;
    branch: any;
    settings: any;
    planName: string;
    expiryDate: Date;
    daysLeft: number;
    milestone: ReminderMilestone;
    expiryFormatted: string;
  }): ReminderTemplateContext {
    const branchId = params.profile.branchId ?? params.user?.branchId ?? PRIMARY_BRANCH_ID;
    const branchName =
      params.settings?.gymName ||
      params.branch?.name ||
      params.settings?.branch ||
      PRIMARY_BRANCH_NAME;

    const fullName = `${params.user?.firstName || ''} ${params.user?.lastName || ''}`.trim() || 'Member';
    const whatsappNumber = normalizeE164Phone(
      params.profile.whatsappNumber ?? params.profile.whatsapp ?? params.user?.phone
    );
    const email = typeof params.user?.email === 'string' && params.user.email.trim()
      ? params.user.email.trim().toLowerCase()
      : null;

    return {
      memberProfileId: params.profile.id,
      userId: params.user?.id || params.profile.userId,
      memberCode: params.profile.memberId || '000',
      memberName: fullName,
      email,
      whatsappNumber,
      branchId,
      branchName,
      branchContactPhone: params.settings?.contactPhone ?? null,
      branchContactEmail: params.settings?.contactEmail ?? null,
      planName: params.planName || 'Membership Plan',
      expiryDateIso: params.expiryDate.toISOString(),
      expiryDateFormatted: params.expiryFormatted,
      daysLeft: params.daysLeft,
      milestone: params.milestone,
      renewalUrl: buildRenewalUrl(
        createRenewalLinkToken({
          memberProfileId: params.profile.id,
          branchId,
        })
      ),
    };
  }

  private async dispatchAndPersistSingleChannel(params: {
    ctx: ReminderTemplateContext;
    channel: NotificationChannel;
    cycleExpiryDate: Date;
    whatsappAdapter: WhatsAppProviderAdapter;
    emailAdapter: EmailProviderAdapter;
  }): Promise<{ status: 'SENT' | 'FAILED' | 'SKIPPED'; providerMessageId?: string | null; reason?: string }> {
    const { ctx, channel, cycleExpiryDate, whatsappAdapter, emailAdapter } = params;

    // 1. Pre-flight idempotency check
    const existing = await this.repo.findExistingDelivery({
      memberId: ctx.memberProfileId,
      channel,
      milestone: ctx.milestone,
      cycleExpiryDate,
    });
    if (existing && (existing.status === 'SENT' || existing.status === 'SKIPPED')) {
      return { status: 'SKIPPED', reason: 'already_sent_for_cycle', providerMessageId: existing.providerMessageId };
    }

    // 2. Validate channel destination presence before calling external API
    if (channel === 'WHATSAPP' && !ctx.whatsappNumber) {
      return this.persistSafely({
        ctx,
        channel,
        cycleExpiryDate,
        existingId: existing?.id,
        status: 'SKIPPED',
        errorMessage: 'No valid E.164 WhatsApp number on member profile',
      });
    }
    if (channel === 'EMAIL' && !ctx.email) {
      return this.persistSafely({
        ctx,
        channel,
        cycleExpiryDate,
        existingId: existing?.id,
        status: 'SKIPPED',
        errorMessage: 'No valid email address on member account',
      });
    }

    // 3. Deliver via provider adapter (with retry)
    try {
      const result =
        channel === 'WHATSAPP'
          ? await whatsappAdapter.sendTemplateReminder(ctx)
          : await emailAdapter.sendReminderEmail(ctx);

      return await this.persistSafely({
        ctx,
        channel,
        cycleExpiryDate,
        existingId: existing?.id,
        status: 'SENT',
        providerMessageId: result.providerMessageId ?? null,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Notification delivery failed';
      logger.warn('Membership reminder delivery failed', {
        channel,
        milestone: ctx.milestone,
        branchId: ctx.branchId,
        memberCode: ctx.memberCode,
        reason: errorMessage,
      });

      return this.persistSafely({
        ctx,
        channel,
        cycleExpiryDate,
        existingId: existing?.id,
        status: 'FAILED',
        errorMessage: errorMessage.slice(0, 400),
      });
    }
  }

  private async persistSafely(params: {
    ctx: ReminderTemplateContext;
    channel: NotificationChannel;
    cycleExpiryDate: Date;
    existingId?: string;
    status: 'SENT' | 'FAILED' | 'SKIPPED';
    providerMessageId?: string | null;
    errorMessage?: string | null;
  }): Promise<{ status: 'SENT' | 'FAILED' | 'SKIPPED'; providerMessageId?: string | null; reason?: string }> {
    const { ctx, channel, cycleExpiryDate, existingId, status, providerMessageId, errorMessage } = params;

    if (existingId) {
      await this.repo.updateNotificationLog(existingId, {
        status,
        providerMessageId: providerMessageId ?? null,
        errorMessage: errorMessage ?? null,
      });
      return { status, providerMessageId: providerMessageId ?? null, reason: errorMessage ?? undefined };
    }

    try {
      await this.repo.createNotificationLog({
        branchId: ctx.branchId,
        memberId: ctx.memberProfileId,
        channel,
        milestone: ctx.milestone,
        cycleExpiryDate,
        status,
        providerMessageId: providerMessageId ?? null,
        errorMessage: errorMessage ?? null,
      });
      return { status, providerMessageId: providerMessageId ?? null, reason: errorMessage ?? undefined };
    } catch (err: any) {
      // Concurrent worker hit compound unique constraint -> treat as already sent cleanly
      if (err?.code === 'P2002') {
        return { status: 'SKIPPED', reason: 'unique_constraint_idempotent' };
      }
      throw err;
    }
  }

  /**
   * Executes the daily timezone-aware expiry reminder batch across candidate memberships.
   */
  async runExpiryReminderBatch(options: ReminderBatchOptions = {}): Promise<ReminderBatchSummary> {
    const now = options.now ?? new Date();
    const timeZone = options.timeZone || process.env.REMINDER_TIMEZONE || 'Asia/Kolkata';
    const dryRun = isDryRunEnvEnabled(options.dryRun);
    const batchSize = Math.max(1, options.batchSize ?? 10);
    const batchDelayMs = Math.max(0, options.batchDelayMs ?? (process.env.NODE_ENV === 'test' ? 0 : 250));

    const whatsappAdapter = options.whatsappAdapter ?? createWhatsAppAdapter({ dryRun });
    const emailAdapter = options.emailAdapter ?? createEmailAdapter({ dryRun });

    const todayParts = getCalendarDayPartsInTz(now, timeZone);
    // Widen DB scan +/- 2 days around [0, 7] to remain independent of DB server local timezone
    const rangeStart = new Date(now.getTime() - 2 * 86_400_000);
    const rangeEnd = new Date(now.getTime() + 9 * 86_400_000);

    const candidateSubs = await this.repo.findCandidateSubscriptions(rangeStart, rangeEnd, options.branchId);

    // Keep latest subscription endDate per member so renewed members never trigger expired alerts on prior cycles
    const latestSubByMember = new Map<string, any>();
    for (const sub of candidateSubs) {
      const existing = latestSubByMember.get(sub.memberId);
      if (!existing || new Date(sub.endDate).getTime() > new Date(existing.endDate).getTime()) {
        latestSubByMember.set(sub.memberId, sub);
      }
    }

    const summary: ReminderBatchSummary = {
      dryRun,
      timeZone,
      targetDate: todayParts.isoDate,
      evaluatedMembers: latestSubByMember.size,
      matchedMilestones: 0,
      sent: 0,
      failed: 0,
      skippedDuplicate: 0,
      skippedOptOut: 0,
      skippedChannelDisabled: 0,
      details: [],
    };

    const settingsCache = new Map<string, any>();
    const pendingTasks: Array<() => Promise<void>> = [];

    for (const sub of latestSubByMember.values()) {
      const profile = sub.member;
      const user = profile?.user;
      if (!profile || !user) continue;

      const { daysLeft, cycleExpiryDate, expiryFormatted } = computeDaysUntilExpiry(
        new Date(sub.endDate),
        now,
        timeZone
      );

      const milestone = MILESTONE_DAYS_MAP[daysLeft];
      if (!milestone) continue;

      const branchId = profile.branchId ?? sub.branchId ?? user.branchId ?? PRIMARY_BRANCH_ID;
      let settings = settingsCache.get(branchId);
      if (settings === undefined) {
        settings = await this.repo.findBranchSettings(branchId);
        settingsCache.set(branchId, settings ?? null);
      }

      const activeMilestones = parseActiveMilestones(settings?.reminderMilestones);
      if (!activeMilestones.has(daysLeft)) continue;

      summary.matchedMilestones += 1;

      if (profile.notificationsEnabled === false) {
        summary.skippedOptOut += 1;
        continue;
      }

      const ctx = this.buildTemplateContext({
        profile,
        user,
        branch: sub.branch,
        settings,
        planName: sub.plan?.name || 'Membership Plan',
        expiryDate: new Date(sub.endDate),
        daysLeft,
        milestone,
        expiryFormatted,
      });

      const channels: NotificationChannel[] = [];
      if (settings?.whatsappRemindersEnabled !== false) channels.push('WHATSAPP');
      else summary.skippedChannelDisabled += 1;

      if (settings?.emailRemindersEnabled !== false) channels.push('EMAIL');
      else summary.skippedChannelDisabled += 1;

      for (const channel of channels) {
        pendingTasks.push(async () => {
          const outcome = await this.dispatchAndPersistSingleChannel({
            ctx,
            channel,
            cycleExpiryDate,
            whatsappAdapter,
            emailAdapter,
          });

          if (outcome.status === 'SENT') summary.sent += 1;
          else if (outcome.status === 'FAILED') summary.failed += 1;
          else summary.skippedDuplicate += 1;

          summary.details.push({
            memberId: ctx.memberProfileId,
            memberCode: ctx.memberCode,
            branchId: ctx.branchId,
            channel,
            milestone: ctx.milestone,
            status: outcome.status,
            reason: outcome.reason,
            providerMessageId: outcome.providerMessageId,
          });
        });
      }
    }

    // Controlled throttled batches
    for (let i = 0; i < pendingTasks.length; i += batchSize) {
      const slice = pendingTasks.slice(i, i + batchSize);
      await Promise.allSettled(slice.map((fn) => fn()));
      if (i + batchSize < pendingTasks.length && batchDelayMs > 0) {
        await pause(batchDelayMs);
      }
    }

    return summary;
  }

  /**
   * Triggers a manual single-member expiry reminder from the Admin UI with strict branch & opt-out checks.
   */
  async sendManualReminder(params: {
    memberId: string;
    channels?: NotificationChannel[];
    milestone?: ReminderMilestone;
    dryRun?: boolean;
    tenant?: TenantScope;
    whatsappAdapter?: WhatsAppProviderAdapter;
    emailAdapter?: EmailProviderAdapter;
  }) {
    const profile = await this.repo.findMemberContextByAnyId(params.memberId);
    if (!profile || !profile.user) {
      throw new NotFoundError('Member not found');
    }

    const branchId = profile.branchId ?? profile.user.branchId ?? PRIMARY_BRANCH_ID;
    assertBranchOwnership(branchId, params.tenant);

    if (profile.notificationsEnabled === false) {
      throw new BadRequestError('Member has opted out of automated/manual reminders', 'MEMBER_OPTED_OUT');
    }

    const settings = await this.repo.findBranchSettings(branchId);
    const latestSub = profile.subscriptions?.[0];
    const now = new Date();
    const timeZone = process.env.REMINDER_TIMEZONE || 'Asia/Kolkata';

    const rawExpiry = latestSub?.endDate ? new Date(latestSub.endDate) : now;
    const { daysLeft, cycleExpiryDate, expiryFormatted } = computeDaysUntilExpiry(rawExpiry, now, timeZone);

    let resolvedMilestone: ReminderMilestone = params.milestone ?? '1_DAY';
    if (!params.milestone) {
      if (daysLeft <= 0) resolvedMilestone = 'EXPIRED';
      else if (daysLeft <= 1) resolvedMilestone = '1_DAY';
      else if (daysLeft <= 3) resolvedMilestone = '3_DAYS';
      else resolvedMilestone = '7_DAYS';
    }

    const dryRun = isDryRunEnvEnabled(params.dryRun);
    const whatsappAdapter = params.whatsappAdapter ?? createWhatsAppAdapter({ dryRun });
    const emailAdapter = params.emailAdapter ?? createEmailAdapter({ dryRun });

    const ctx = this.buildTemplateContext({
      profile,
      user: profile.user,
      branch: profile.branch,
      settings,
      planName: latestSub?.plan?.name || 'Membership Plan',
      expiryDate: rawExpiry,
      daysLeft: Math.max(0, daysLeft),
      milestone: resolvedMilestone,
      expiryFormatted,
    });

    const targetChannels: NotificationChannel[] = params.channels?.length
      ? params.channels
      : ['WHATSAPP', 'EMAIL'];

    const results = [];
    for (const channel of targetChannels) {
      const outcome = await this.dispatchAndPersistSingleChannel({
        ctx,
        channel,
        cycleExpiryDate,
        whatsappAdapter,
        emailAdapter,
      });
      results.push({ channel, milestone: resolvedMilestone, ...outcome });
    }

    return {
      memberId: profile.id,
      memberCode: profile.memberId,
      memberName: ctx.memberName,
      branchId,
      dryRun,
      results,
    };
  }

  /**
   * One-click retry for a single FAILED notification log entry (strict branch ownership verified).
   */
  async retryFailedLog(params: {
    logId: string;
    tenant?: TenantScope;
    dryRun?: boolean;
    whatsappAdapter?: WhatsAppProviderAdapter;
    emailAdapter?: EmailProviderAdapter;
  }) {
    const existingLog = await this.repo.findNotificationLogById(params.logId);
    if (!existingLog || !existingLog.member?.user) {
      throw new NotFoundError('Notification log entry not found');
    }

    const branchId = existingLog.branchId ?? existingLog.member.branchId ?? PRIMARY_BRANCH_ID;
    assertBranchOwnership(branchId, params.tenant);

    if (existingLog.status === 'SENT') {
      throw new BadRequestError('Notification already delivered successfully', 'ALREADY_SENT');
    }
    if (existingLog.member.notificationsEnabled === false) {
      throw new BadRequestError('Member has opted out of reminder notifications', 'MEMBER_OPTED_OUT');
    }

    const settings = await this.repo.findBranchSettings(branchId);
    const dryRun = isDryRunEnvEnabled(params.dryRun);
    const whatsappAdapter = params.whatsappAdapter ?? createWhatsAppAdapter({ dryRun });
    const emailAdapter = params.emailAdapter ?? createEmailAdapter({ dryRun });

    const now = new Date();
    const timeZone = process.env.REMINDER_TIMEZONE || 'Asia/Kolkata';
    const cycleDate = new Date(existingLog.cycleExpiryDate);
    const { daysLeft, expiryFormatted } = computeDaysUntilExpiry(cycleDate, now, timeZone);

    const ctx = this.buildTemplateContext({
      profile: existingLog.member,
      user: existingLog.member.user,
      branch: existingLog.branch,
      settings,
      planName: 'Membership Plan',
      expiryDate: cycleDate,
      daysLeft: Math.max(0, daysLeft),
      milestone: existingLog.milestone as ReminderMilestone,
      expiryFormatted,
    });

    const outcome = await this.dispatchAndPersistSingleChannel({
      ctx,
      channel: existingLog.channel as NotificationChannel,
      cycleExpiryDate: cycleDate,
      whatsappAdapter,
      emailAdapter,
    });

    return {
      logId: existingLog.id,
      channel: existingLog.channel,
      milestone: existingLog.milestone,
      branchId,
      dryRun,
      ...outcome,
    };
  }

  listLogs(options: {
    branchId?: string | null;
    status?: string;
    channel?: string;
    limit?: number;
  }) {
    return this.repo.listNotificationLogs(options);
  }

  /**
   * Sends non-blocking payment confirmation + attached PDF receipt over Email & WhatsApp.
   * Respects DRY_RUN and gracefully records skips/failures without aborting payment capture.
   */
  async sendPaymentReceiptNotification(
    ctx: PaymentConfirmationContext,
    options: {
      dryRun?: boolean;
      emailAdapter?: EmailProviderAdapter;
      whatsappAdapter?: WhatsAppProviderAdapter;
    } = {}
  ): Promise<{
    email: { status: string; providerMessageId?: string | null; reason?: string };
    whatsapp: { status: string; providerMessageId?: string | null; reason?: string };
  }> {
    const dryRun = isDryRunEnvEnabled(options.dryRun);
    const emailAdapter = options.emailAdapter ?? createEmailAdapter({ dryRun });
    const whatsappAdapter = options.whatsappAdapter ?? createWhatsAppAdapter({ dryRun });

    const sendEmail = async () => {
      if (!ctx.email) return { status: 'SKIPPED', reason: 'missing_email' };
      if (!emailAdapter.isConfigured()) return { status: 'SKIPPED', reason: 'provider_not_configured' };
      if (!emailAdapter.sendPaymentReceiptEmail) return { status: 'SKIPPED', reason: 'unsupported' };
      try {
        const res = await emailAdapter.sendPaymentReceiptEmail(ctx);
        return { status: res.status, providerMessageId: res.providerMessageId ?? null };
      } catch (err) {
        const reason = err instanceof Error ? err.message : 'email_failed';
        logger.warn('Payment receipt email delivery failed', {
          invoiceNumber: ctx.invoiceNumber,
          memberCode: ctx.memberCode,
          reason,
        });
        return { status: 'FAILED', reason };
      }
    };

    const sendWhatsapp = async () => {
      if (!ctx.whatsappNumber) return { status: 'SKIPPED', reason: 'missing_whatsapp' };
      if (!whatsappAdapter.isConfigured()) return { status: 'SKIPPED', reason: 'provider_not_configured' };
      if (!whatsappAdapter.sendPaymentConfirmation) return { status: 'SKIPPED', reason: 'unsupported' };
      try {
        const res = await whatsappAdapter.sendPaymentConfirmation(ctx);
        return { status: res.status, providerMessageId: res.providerMessageId ?? null };
      } catch (err) {
        const reason = err instanceof Error ? err.message : 'whatsapp_failed';
        logger.warn('Payment receipt WhatsApp delivery failed', {
          invoiceNumber: ctx.invoiceNumber,
          memberCode: ctx.memberCode,
          reason,
        });
        return { status: 'FAILED', reason };
      }
    };

    const [email, whatsapp] = await Promise.all([sendEmail(), sendWhatsapp()]);
    return { email, whatsapp };
  }
}

export const notificationService = new NotificationService();
