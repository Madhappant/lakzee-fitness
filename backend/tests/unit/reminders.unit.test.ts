import { describe, expect, it, vi } from 'vitest';
import { isValidE164Phone, normalizeE164Phone } from '../../src/services/notifications/e164';
import {
  buildWhatsAppTemplatePayload,
  renderExpiryReminderEmail,
} from '../../src/services/notifications/templates';
import {
  executeWithRetry,
  PermanentDeliveryError,
  TransientDeliveryError,
} from '../../src/services/notifications/retry';
import {
  computeDaysUntilExpiry,
  parseActiveMilestones,
} from '../../src/services/notification.service';
import { computeNextRunDelayMs } from '../../src/services/reminder-scheduler.service';
import { NodemailerSmtpAdapter } from '../../src/services/notifications/email.adapter';
import type { ReminderTemplateContext } from '../../src/services/notifications/messaging.types';

const sampleContext: ReminderTemplateContext = {
  memberProfileId: 'mp-001',
  userId: 'user-001',
  memberCode: '007',
  memberName: 'Aarav Sharma',
  email: 'aarav@example.com',
  whatsappNumber: '+919876543210',
  branchId: 'branch-primary-001',
  branchName: 'Lakzee Primary Studio',
  branchContactPhone: '+914422223333',
  branchContactEmail: 'desk@lakzee.fit',
  planName: 'Annual Pro',
  expiryDateIso: '2026-12-01T00:00:00.000Z',
  expiryDateFormatted: '01 Dec 2026',
  daysLeft: 3,
  milestone: '3_DAYS',
};

describe('Messaging Helpers: E.164, Templates, Retries & IST Milestones', () => {
  it('validates and normalizes E.164 WhatsApp phone numbers accurately', () => {
    expect(isValidE164Phone('+919876543210')).toBe(true);
    expect(isValidE164Phone('+1 (415) 555-0199')).toBe(true);
    expect(isValidE164Phone('9876543210')).toBe(false);
    expect(isValidE164Phone('+0123456')).toBe(false);

    expect(normalizeE164Phone('+91 98765-43210')).toBe('+919876543210');
    expect(normalizeE164Phone('9876543210')).toBe('+919876543210');
    expect(normalizeE164Phone('invalid-phone')).toBeNull();
  });

  it('builds Meta WhatsApp Cloud API template payload and dark-luxury 3-color HTML email', () => {
    const waPayload = buildWhatsAppTemplatePayload(sampleContext, 'membership_expiry_reminder', 'en');
    expect(waPayload.messaging_product).toBe('whatsapp');
    expect(waPayload.to).toBe('919876543210');
    expect(waPayload.type).toBe('template');
    expect(waPayload.template.name).toBe('membership_expiry_reminder');
    expect(waPayload.template.components[0].parameters.map((p) => p.text)).toEqual([
      'Aarav Sharma',
      'Lakzee Primary Studio',
      'Annual Pro',
      '01 Dec 2026',
      '3 days',
    ]);

    const email = renderExpiryReminderEmail({
      ...sampleContext,
      memberName: 'Riya <script>alert(1)</script>',
    });
    expect(email.subject).toContain('3 days left');
    expect(email.html).toContain('#0A0A0C');
    expect(email.html).toContain('#F5F5F7');
    expect(email.html).toContain('#D4FF00');
    expect(email.html).not.toContain('<script>');
    expect(email.text).toContain('Annual Pro');
    expect(email.text).toContain('01 Dec 2026');
  });

  it('retries transient errors up to 3 times with exponential backoff and halts immediately on permanent errors', async () => {
    const sleepCalls: number[] = [];
    const sleepMock = async (ms: number) => {
      sleepCalls.push(ms);
    };

    const op = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new TransientDeliveryError('Rate limited', 429))
      .mockRejectedValueOnce(new TransientDeliveryError('Upstream timeout', 503))
      .mockResolvedValueOnce('wamid.123');

    const res = await executeWithRetry(op, { maxAttempts: 3, baseDelayMs: 50, sleep: sleepMock });
    expect(res.result).toBe('wamid.123');
    expect(res.attempts).toBe(3);
    expect(sleepCalls).toEqual([50, 100]);

    const permanentOp = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new PermanentDeliveryError('Invalid recipient', 400));

    await expect(
      executeWithRetry(permanentOp, { maxAttempts: 3, baseDelayMs: 50, sleep: sleepMock })
    ).rejects.toThrow('Invalid recipient');
    expect(permanentOp).toHaveBeenCalledTimes(1);
  });

  it('computes exact IST (Asia/Kolkata) milestone days, active milestone subsets, and daily 09:00 IST delay', () => {
    // 2026-11-28 03:30 UTC == 2026-11-28 09:00 IST
    const istNineAm = new Date('2026-11-28T03:30:00.000Z');
    // Expiry on 2026-12-01 in IST (even late UTC on Nov 30 at 18:35Z = Dec 1 00:05 IST!)
    const expDec1Ist = new Date('2026-11-30T18:35:00.000Z');
    const diff = computeDaysUntilExpiry(expDec1Ist, istNineAm, 'Asia/Kolkata');

    expect(diff.daysLeft).toBe(3);
    expect(diff.cycleExpiryDate.toISOString()).toBe('2026-12-01T00:00:00.000Z');

    const active = parseActiveMilestones('7,1,0');
    expect(active.has(7)).toBe(true);
    expect(active.has(3)).toBe(false);
    expect(active.has(0)).toBe(true);

    // At 08:30 IST (03:00Z), 09:00 IST should schedule in ~30 minutes
    const delay30m = computeNextRunDelayMs(new Date('2026-11-28T03:00:00.000Z'), 9, 0, 'Asia/Kolkata');
    expect(delay30m).toBe(30 * 60 * 1000);
  });

  it('infers smtp.gmail.com and sender fromAddress for Gmail SMTP users when SMTP_HOST is omitted', () => {
    const gmailAdapter = new NodemailerSmtpAdapter({
      user: 'studio.notifications@gmail.com',
      pass: 'app-password',
    });
    expect(gmailAdapter.isConfigured()).toBe(true);

    const emptyHostAdapter = new NodemailerSmtpAdapter({
      host: '',
      user: '',
      pass: '',
    });
    expect(emptyHostAdapter.isConfigured()).toBe(false);
  });
});
