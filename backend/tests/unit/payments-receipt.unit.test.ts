import '../setup';
import crypto from 'crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  HttpRazorpayAdapter,
  verifyRazorpayCheckoutSignature,
  verifyRazorpayWebhookSignature,
} from '../../src/services/payments/razorpay.adapter';
import { computeExtendedExpiryDates } from '../../src/repositories/payment.repository';
import {
  buildRenewalUrl,
  createRenewalLinkToken,
  verifyRenewalLinkToken,
} from '../../src/services/payments/renewal-token';
import { ReceiptService } from '../../src/services/payments/receipt.service';
import {
  DryRunEmailAdapter,
  ResendEmailAdapter,
} from '../../src/services/notifications/email.adapter';
import {
  DryRunWhatsAppAdapter,
} from '../../src/services/notifications/whatsapp.adapter';
import { NotificationService } from '../../src/services/notification.service';

describe('Razorpay Signatures, Expiry Math, Signed Renewal Links & PDF Receipts (Unit)', () => {
  it('verifies checkout HMAC-SHA256 signatures and rejects tampered payloads', () => {
    const keySecret = 'unit-test-razorpay-key-secret';
    const orderId = 'order_unit_001';
    const paymentId = 'pay_unit_001';
    const validSig = crypto
      .createHmac('sha256', keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    expect(
      verifyRazorpayCheckoutSignature({ orderId, paymentId, signature: validSig, keySecret })
    ).toBe(true);
    expect(
      verifyRazorpayCheckoutSignature({ orderId, paymentId, signature: `${validSig.slice(0, -2)}00`, keySecret })
    ).toBe(false);
    expect(
      verifyRazorpayCheckoutSignature({ orderId: 'order_tampered', paymentId, signature: validSig, keySecret })
    ).toBe(false);
  });

  it('verifies webhook x-razorpay-signature strictly against unaltered raw request bytes', () => {
    const webhookSecret = 'unit-test-webhook-secret';
    const rawBody = Buffer.from('{"event":"payment.captured","payload":{"payment":{"entity":{"id":"pay_1"}}}}', 'utf8');
    const validSig = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');

    expect(
      verifyRazorpayWebhookSignature({ rawBody, signature: validSig, webhookSecret })
    ).toBe(true);

    const modifiedWhitespaceBody = Buffer.from(
      '{ "event": "payment.captured", "payload": { "payment": { "entity": { "id": "pay_1" } } } }',
      'utf8'
    );
    expect(
      verifyRazorpayWebhookSignature({ rawBody: modifiedWhitespaceBody, signature: validSig, webhookSecret })
    ).toBe(false);
  });

  it('extends active subscriptions from existing endDate and expired subscriptions from today', () => {
    const now = new Date('2026-06-01T10:00:00.000Z');

    // Active member with 10 days left + 30-day renewal -> 40 days from now
    const activeEnd = new Date('2026-06-11T10:00:00.000Z');
    const activeResult = computeExtendedExpiryDates({
      latestSubscription: { status: 'ACTIVE', endDate: activeEnd },
      durationDays: 30,
      now,
    });
    expect(activeResult.previousExpiryDate?.toISOString()).toBe(activeEnd.toISOString());
    expect(activeResult.newExpiryDate.toISOString()).toBe('2026-07-11T10:00:00.000Z');

    // Expired member (ended 5 days ago) + 30-day renewal -> 30 days from today (now)
    const expiredEnd = new Date('2026-05-27T10:00:00.000Z');
    const expiredResult = computeExtendedExpiryDates({
      latestSubscription: { status: 'EXPIRED', endDate: expiredEnd },
      durationDays: 30,
      now,
    });
    expect(expiredResult.newExpiryDate.toISOString()).toBe('2026-07-01T10:00:00.000Z');
  });

  it('generates and verifies tamper-proof, expiring one-click renewal links', () => {
    const nowMs = Date.UTC(2026, 5, 1, 9, 0, 0);
    const token = createRenewalLinkToken({
      memberProfileId: 'mp-123',
      branchId: 'branch-a',
      planId: 'plan-gold',
      ttlSeconds: 3600,
      nowMs,
    });

    const url = buildRenewalUrl(token);
    expect(url).toContain('/renew?token=');

    const decoded = verifyRenewalLinkToken(token, nowMs + 1000);
    expect(decoded.memberProfileId).toBe('mp-123');
    expect(decoded.branchId).toBe('branch-a');
    expect(decoded.planId).toBe('plan-gold');

    // Tampered token rejects cleanly
    const tampered = `${token.slice(0, -3)}xxx`;
    expect(() => verifyRenewalLinkToken(tampered, nowMs + 1000)).toThrow();

    // Expired token rejects cleanly
    expect(() => verifyRenewalLinkToken(token, nowMs + 3601 * 1000)).toThrow(/expired/i);
  });

  it('generates a valid in-memory PDF receipt buffer with PDFKit', async () => {
    const service = new ReceiptService();
    const pdfBuffer = await service.generateReceiptPdf({
      paymentId: 'pay-rec-1',
      invoiceNumber: 'INV-BR001-2026-0001',
      gymName: 'Lakzee Fitness Studio',
      branchName: 'Lakzee Adyar',
      branchLocation: 'Adyar, Chennai',
      branchGstNumber: '33AAACL1234A1Z5',
      branchContactPhone: '+91 9876543210',
      branchContactEmail: 'studio@lakzee.fit',
      memberName: 'Aarav One',
      memberCode: '001',
      memberEmail: 'aarav.001@lakzee.test',
      memberPhone: '+919876543210',
      planName: 'Pro Strength',
      durationDays: 30,
      totalAmountInr: 2360,
      gstPercentage: 18,
      paymentMethod: 'upi',
      razorpayOrderId: 'order_rzp_001',
      razorpayPaymentId: 'pay_rzp_001',
      paidAt: new Date('2026-06-01T10:30:00Z'),
      previousExpiryDate: new Date('2026-06-10T00:00:00Z'),
      newExpiryDate: new Date('2026-07-10T00:00:00Z'),
    });

    expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
    expect(pdfBuffer.subarray(0, 5).toString('utf8')).toBe('%PDF-');
    expect(pdfBuffer.length).toBeGreaterThan(1500);
  });

  it('attaches generated PDF receipts in Resend Email notifications and creates mock/real Razorpay orders safely', async () => {
    const adapter = new HttpRazorpayAdapter({
      keyId: 'rzp_test_unit',
      keySecret: 'secret_unit',
      mockMode: true,
    });
    const order = await adapter.createOrder({
      amountInPaise: 249900,
      currency: 'INR',
      receipt: 'RCPT-001',
      notes: { branchId: 'branch-a' },
    });
    expect(order.orderId).toMatch(/^order_mock_/);
    expect(order.amountInPaise).toBe(249900);

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'resend-msg-999' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const emailAdapter = new ResendEmailAdapter({
      apiKey: 're_test_key',
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    const notifService = new NotificationService();

    const outcome = await notifService.sendPaymentReceiptNotification(
      {
        paymentId: 'pay-999',
        invoiceNumber: 'INV-BR001-2026-0009',
        memberProfileId: 'mp-1',
        memberCode: '001',
        memberName: 'Aarav One',
        email: 'aarav.001@lakzee.test',
        whatsappNumber: '+919876543210',
        branchId: 'branch-a',
        branchName: 'Lakzee Primary',
        planName: 'Pro Strength',
        durationDays: 30,
        amountPaidInr: 2499,
        method: 'upi',
        razorpayPaymentId: 'pay_rzp_999',
        paidAtFormatted: '01 Jun 2026',
        newExpiryFormatted: '01 Jul 2026',
        receiptUrl: 'http://localhost:3000/member/subscriptions',
        pdfBuffer: Buffer.from('%PDF-1.4\n%%EOF', 'utf8'),
        pdfFilename: 'Receipt-INV-BR001-2026-0009.pdf',
      },
      {
        emailAdapter,
        whatsappAdapter: new DryRunWhatsAppAdapter(),
      }
    );

    expect(outcome.email.status).toBe('SENT');
    expect(outcome.email.providerMessageId).toBe('resend-msg-999');
    expect(outcome.whatsapp.status).toBe('SENT');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const sentBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body || '{}'));
    expect(sentBody.attachments?.[0]?.filename).toBe('Receipt-INV-BR001-2026-0009.pdf');
    expect(typeof sentBody.attachments?.[0]?.content).toBe('string');

    // DryRunEmailAdapter smoke check
    const dryRes = await new DryRunEmailAdapter().sendPaymentReceiptEmail({
      paymentId: 'p1',
      invoiceNumber: 'INV-1',
      memberProfileId: 'm1',
      memberCode: '001',
      memberName: 'Aarav',
      email: 'a@b.com',
      whatsappNumber: null,
      branchId: 'b1',
      branchName: 'Main',
      planName: 'Gold',
      durationDays: 30,
      amountPaidInr: 1000,
      method: 'upi',
      paidAtFormatted: '01 Jun 2026',
      newExpiryFormatted: '01 Jul 2026',
      receiptUrl: 'http://localhost:3000/member/subscriptions',
    });
    expect(dryRes.dryRun).toBe(true);
  });
});
