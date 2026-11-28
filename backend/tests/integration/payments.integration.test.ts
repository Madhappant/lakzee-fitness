import '../setup';
import crypto from 'crypto';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { InMemoryPrismaDatabase } from '../factories/in-memory-db.factory';
import { buildMemberPair } from '../factories/member.factory';
import {
  buildAdminUser,
  buildSuperAdminUser,
  DEFAULT_TEST_PASSWORD,
} from '../factories/user.factory';

describe('Razorpay Payments, Webhook Idempotency, PDF Receipts & Renewal Links (Integration)', () => {
  let app: any;
  let prisma: any;
  let memoryCache: any;
  const db = new InMemoryPrismaDatabase();
  let uninstallDb: (() => void) | null = null;

  const KEY_SECRET = 'integration-test-rzp-key-secret';
  const WEBHOOK_SECRET = 'integration-test-rzp-webhook-secret';

  let memberAToken = '';
  let memberOtherToken = '';
  let adminAToken = '';
  let adminBToken = '';

  const seedScenario = () => {
    const now = new Date();
    const tenDaysLater = new Date(now.getTime() + 10 * 86_400_000);
    const fiveDaysAgo = new Date(now.getTime() - 5 * 86_400_000);

    const adminA = buildAdminUser({
      id: 'adm-pay-a',
      email: 'admin.pay.a@lakzee.test',
      branchId: 'branch-a',
    });
    const adminB = buildAdminUser({
      id: 'adm-pay-b',
      email: 'admin.pay.b@lakzee.test',
      branchId: 'branch-b',
    });
    const superAdmin = buildSuperAdminUser({
      id: 'sup-pay-1',
      email: 'super.pay@lakzee.test',
      branchId: 'branch-a',
    });

    const memberA = buildMemberPair({
      userId: 'u-pay-a',
      profileId: 'mp-pay-a',
      branchId: 'branch-a',
      memberId: '001',
      firstName: 'Aarav',
      lastName: 'Active',
      email: 'aarav.pay@lakzee.test',
      phone: '+919876540001',
    });
    const memberOther = buildMemberPair({
      userId: 'u-pay-other',
      profileId: 'mp-pay-other',
      branchId: 'branch-a',
      memberId: '002',
      firstName: 'Riya',
      lastName: 'Other',
      email: 'riya.pay@lakzee.test',
      phone: '+919876540002',
    });

    db.reset({
      branches: [
        {
          id: 'branch-a',
          name: 'Lakzee Adyar',
          code: 'BR-001',
          location: 'Adyar',
          status: 'ACTIVE',
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'branch-b',
          name: 'Lakzee Anna Nagar',
          code: 'BR-002',
          location: 'Anna Nagar',
          status: 'ACTIVE',
          createdAt: now,
          updatedAt: now,
        },
      ],
      users: [adminA, adminB, superAdmin, memberA.user, memberOther.user],
      memberProfiles: [memberA.profile, memberOther.profile],
      plans: [
        {
          id: 'plan-branch-a-gold',
          branchId: 'branch-a',
          name: 'Gold Monthly',
          description: '30-Day Pro Access',
          price: 2360,
          priceInPaise: 236000,
          durationDays: 30,
          gstPercentage: 18,
          taxPercent: 18,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        },
      ],
      subscriptions: [
        {
          id: 'sub-initial-active',
          branchId: 'branch-a',
          memberId: 'mp-pay-a',
          planId: 'plan-branch-a-gold',
          startDate: fiveDaysAgo,
          endDate: tenDaysLater,
          status: 'ACTIVE',
          paymentStatus: 'PAID',
          paymentMethod: 'CASH',
          balanceAmount: 0,
          createdAt: fiveDaysAgo,
          updatedAt: fiveDaysAgo,
        },
      ],
    });
  };

  beforeAll(async () => {
    process.env.DRY_RUN = 'true';
    process.env.RAZORPAY_MOCK_MODE = 'true';
    process.env.RAZORPAY_KEY_ID = 'rzp_test_integration_id';
    process.env.RAZORPAY_KEY_SECRET = KEY_SECRET;
    process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;

    const appMod = await import('../../src/app');
    const cacheMod = await import('../../src/utils/cache');
    app = appMod.default;
    prisma = appMod.prisma;
    memoryCache = cacheMod.memoryCache;
    uninstallDb = db.installOnto(prisma);

    memoryCache.clear();
    seedScenario();

    const login = async (email: string) => {
      const res = await request(app).post('/api/auth/login').send({
        email,
        password: DEFAULT_TEST_PASSWORD,
      });
      expect(res.status).toBe(200);
      return (res.body.data.accessToken || res.body.data.token) as string;
    };

    memberAToken = await login('aarav.pay@lakzee.test');
    memberOtherToken = await login('riya.pay@lakzee.test');
    adminAToken = await login('admin.pay.a@lakzee.test');
    adminBToken = await login('admin.pay.b@lakzee.test');
  });

  afterAll(() => {
    uninstallDb?.();
  });

  beforeEach(() => {
    memoryCache.clear();
    seedScenario();
  });

  it('derives authoritative paise amount from DB regardless of client payload, enforces ownership, and rejects invalid checkout signatures', async () => {
    // Member A creates order (attempts to sneak spoofed amount/price in body -> ignored cleanly by server)
    const createRes = await request(app)
      .post('/api/payments/create-order')
      .set('Authorization', `Bearer ${memberAToken}`)
      .send({
        planId: 'plan-branch-a-gold',
        amount: 1,
        amountInPaise: 100,
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.data.amountInPaise).toBe(236000);
    expect(createRes.body.data.amount).toBe(2360);
    expect(createRes.body.data.currency).toBe('INR');

    const orderId = createRes.body.data.orderId;

    // Tampered Razorpay signature must be rejected with 400
    const badVerifyRes = await request(app)
      .post('/api/payments/verify')
      .set('Authorization', `Bearer ${memberAToken}`)
      .send({
        razorpay_order_id: orderId,
        razorpay_payment_id: 'pay_test_tampered',
        razorpay_signature: 'invalid_hex_signature',
      });
    expect(badVerifyRes.status).toBe(400);

    // Another member cannot verify Aarav's order -> 403
    const crossMemberVerify = await request(app)
      .post('/api/payments/verify')
      .set('Authorization', `Bearer ${memberOtherToken}`)
      .send({
        razorpay_order_id: orderId,
        razorpay_payment_id: 'pay_test_tampered',
        razorpay_signature: 'invalid_hex_signature',
      });
    expect(crossMemberVerify.status).toBe(403);
  });

  it('is strictly idempotent across verify + duplicate webhooks, extends active expiry once, and streams branded PDF receipt with branch isolation', async () => {
    const initialSubEndMs = db.subscriptions[0].endDate.getTime();

    const orderRes = await request(app)
      .post('/api/payments/create-order')
      .set('Authorization', `Bearer ${memberAToken}`)
      .send({ planId: 'plan-branch-a-gold' });
    expect(orderRes.status).toBe(201);

    const { orderId, paymentRecordId } = orderRes.body.data;
    const rzpPaymentId = 'pay_e2e_idempotent_001';
    const checkoutSig = crypto
      .createHmac('sha256', KEY_SECRET)
      .update(`${orderId}|${rzpPaymentId}`)
      .digest('hex');

    // 1. Valid client verify -> CAPTURED + single extended subscription (initialEnd + 30 days)
    const verify1 = await request(app)
      .post('/api/payments/verify')
      .set('Authorization', `Bearer ${memberAToken}`)
      .send({
        razorpay_order_id: orderId,
        razorpay_payment_id: rzpPaymentId,
        razorpay_signature: checkoutSig,
        method: 'upi',
      });

    expect(verify1.status).toBe(200);
    expect(verify1.body.data.alreadyCaptured).toBe(false);
    expect(verify1.body.data.payment.status).toBe('CAPTURED');
    expect(verify1.body.data.payment.invoiceNumber).toMatch(/^INV-BR001-\d{4}-0001$/);
    expect(db.subscriptions).toHaveLength(2);
    expect(db.invoices).toHaveLength(1);

    const expectedNewEndMs = initialSubEndMs + 30 * 86_400_000;
    const capturedExpiryMs = new Date(verify1.body.data.payment.newExpiryDate).getTime();
    expect(Math.abs(capturedExpiryMs - expectedNewEndMs)).toBeLessThan(1000);

    // 2. Duplicate verify call must NOT extend again or fail
    const verify2 = await request(app)
      .post('/api/payments/verify')
      .set('Authorization', `Bearer ${memberAToken}`)
      .send({
        razorpay_order_id: orderId,
        razorpay_payment_id: rzpPaymentId,
        razorpay_signature: checkoutSig,
        method: 'upi',
      });
    expect(verify2.status).toBe(200);
    expect(verify2.body.data.alreadyCaptured).toBe(true);
    expect(db.subscriptions).toHaveLength(2);
    expect(db.invoices).toHaveLength(1);

    // 3. Replayed Razorpay payment.captured webhook with valid raw signature -> idempotent no-op!
    const webhookBody = JSON.stringify({
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: rzpPaymentId,
            order_id: orderId,
            amount: 236000,
            method: 'upi',
            status: 'captured',
          },
        },
      },
    });
    const webhookSig = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(Buffer.from(webhookBody, 'utf8'))
      .digest('hex');

    const webhookRes = await request(app)
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', webhookSig)
      .send(webhookBody);

    expect(webhookRes.status).toBe(200);
    expect(webhookRes.body.data.processed).toBe(true);
    expect(webhookRes.body.data.alreadyCaptured).toBe(true);
    expect(db.subscriptions).toHaveLength(2);

    // 4. Forged webhook signature rejected strictly
    const badWebhookRes = await request(app)
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', 'deadbeef')
      .send(webhookBody);
    expect(badWebhookRes.status).toBe(400);

    // 5. PDF receipt download allowed for owning member and branch A admin, blocked with 403 for branch B admin & other member
    const memberPdfRes = await request(app)
      .get(`/api/payments/${paymentRecordId}/receipt`)
      .set('Authorization', `Bearer ${memberAToken}`)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(memberPdfRes.status).toBe(200);
    expect(memberPdfRes.headers['content-type']).toContain('application/pdf');
    expect((memberPdfRes.body as Buffer).subarray(0, 5).toString('utf8')).toBe('%PDF-');

    const adminAPdfRes = await request(app)
      .get(`/api/payments/${paymentRecordId}/receipt`)
      .set('Authorization', `Bearer ${adminAToken}`);
    expect(adminAPdfRes.status).toBe(200);

    const adminBPdfRes = await request(app)
      .get(`/api/payments/${paymentRecordId}/receipt`)
      .set('Authorization', `Bearer ${adminBToken}`);
    expect(adminBPdfRes.status).toBe(403);

    const otherMemberPdfRes = await request(app)
      .get(`/api/payments/${paymentRecordId}/receipt`)
      .set('Authorization', `Bearer ${memberOtherToken}`);
    expect(otherMemberPdfRes.status).toBe(403);
  });

  it('completes one-click signed renewal link lifecycle & marks failed webhook payments cleanly', async () => {
    // 1. Admin generates signed renewal link for member 002 (no active sub -> expired path)
    const linkRes = await request(app)
      .post('/api/payments/renewal-link/mp-pay-other')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ planId: 'plan-branch-a-gold' });
    expect(linkRes.status).toBe(201);
    const { token, renewalUrl } = linkRes.body.data;
    expect(renewalUrl).toContain(`/renew?token=${encodeURIComponent(token)}`);

    // 2. Public preview fetches member & plan details cleanly without JWT
    const previewRes = await request(app).get(`/api/payments/renewal/${encodeURIComponent(token)}`);
    expect(previewRes.status).toBe(200);
    expect(previewRes.body.data.member.memberId).toBe('002');
    expect(previewRes.body.data.plans).toHaveLength(1);

    // 3. Create order via token, verify via webhook first (payment.failed -> status FAILED)
    const failOrderRes = await request(app)
      .post(`/api/payments/renewal/${encodeURIComponent(token)}/create-order`)
      .send({ planId: 'plan-branch-a-gold' });
    expect(failOrderRes.status).toBe(201);
    const failOrderId = failOrderRes.body.data.orderId;

    const failWebhookBody = JSON.stringify({
      event: 'payment.failed',
      payload: {
        payment: {
          entity: {
            id: 'pay_failed_123',
            order_id: failOrderId,
            method: 'upi',
            error_description: 'UPI collect request expired',
          },
        },
      },
    });
    const failSig = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(Buffer.from(failWebhookBody, 'utf8'))
      .digest('hex');

    const failHookRes = await request(app)
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', failSig)
      .send(failWebhookBody);
    expect(failHookRes.status).toBe(200);
    expect(failHookRes.body.data.status).toBe('FAILED');
    expect(db.subscriptions).toHaveLength(1); // Membership NOT extended on failure

    // 4. Create fresh order via token & capture via public verify + download public receipt PDF
    const okOrderRes = await request(app)
      .post(`/api/payments/renewal/${encodeURIComponent(token)}/create-order`)
      .send({ planId: 'plan-branch-a-gold' });
    expect(okOrderRes.status).toBe(201);
    const okOrderId = okOrderRes.body.data.orderId;
    const okPaymentRecordId = okOrderRes.body.data.paymentRecordId;
    const okRzpPayId = 'pay_token_success_002';
    const okSig = crypto
      .createHmac('sha256', KEY_SECRET)
      .update(`${okOrderId}|${okRzpPayId}`)
      .digest('hex');

    const okVerifyRes = await request(app)
      .post(`/api/payments/renewal/${encodeURIComponent(token)}/verify`)
      .send({
        razorpay_order_id: okOrderId,
        razorpay_payment_id: okRzpPayId,
        razorpay_signature: okSig,
        method: 'upi',
      });
    expect(okVerifyRes.status).toBe(200);
    expect(okVerifyRes.body.data.payment.status).toBe('CAPTURED');
    expect(db.subscriptions).toHaveLength(2);

    const publicPdfRes = await request(app)
      .get(`/api/payments/renewal/${encodeURIComponent(token)}/receipt/${okPaymentRecordId}`)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(publicPdfRes.status).toBe(200);
    expect((publicPdfRes.body as Buffer).subarray(0, 5).toString('utf8')).toBe('%PDF-');
  });
});
