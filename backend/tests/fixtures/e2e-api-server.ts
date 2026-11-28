/**
 * Isolated E2E Test Backend Harness.
 * Sets isolated env vars BEFORE dynamically importing Express `app` so ES module
 * import hoisting never leaks local `.env` or blocks `http://127.0.0.1:3100` CORS.
 */
process.env.NODE_ENV = 'development';
process.env.PORT = process.env.E2E_API_PORT || '5055';
process.env.DATABASE_URL = 'postgresql://e2e_isolated:e2e_isolated@127.0.0.1:5432/lakzee_e2e?schema=public';
process.env.DIRECT_URL = 'postgresql://e2e_isolated:e2e_isolated@127.0.0.1:5432/lakzee_e2e?schema=public';
process.env.JWT_SECRET = 'e2e-isolated-access-secret-lakzee-2026-min-length';
process.env.JWT_REFRESH_SECRET = 'e2e-isolated-refresh-secret-lakzee-2026-min-length';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.CLIENT_URL = 'http://127.0.0.1:3100,http://localhost:3100,http://localhost:3000';
process.env.DRY_RUN = 'true';
process.env.CRON_SECRET = 'e2e-isolated-cron-secret';
process.env.RAZORPAY_KEY_ID = 'rzp_test_e2e_lakzee';
process.env.RAZORPAY_KEY_SECRET = 'e2e-isolated-rzp-key-secret';
process.env.RAZORPAY_WEBHOOK_SECRET = 'e2e-isolated-rzp-webhook-secret';
process.env.RAZORPAY_MOCK_MODE = 'true';

import crypto from 'crypto';
import http from 'http';
import { InMemoryPrismaDatabase } from '../factories/in-memory-db.factory';
import {
  buildMemberPair,
  createSequentialMemberRoster,
  resetMemberFactorySequence,
} from '../factories/member.factory';
import {
  buildAdminUser,
  buildStaffUser,
  buildSuperAdminUser,
  resetUserFactorySequence,
} from '../factories/user.factory';

export const E2E_PRIMARY_BRANCH_ID = 'branch-primary-001';
export const E2E_SECONDARY_BRANCH_ID = 'branch-secondary-002';

async function bootstrapE2EApiServer() {
  const [{ default: app, prisma }, { memoryCache }] = await Promise.all([
    import('../../src/app'),
    import('../../src/utils/cache'),
  ]);

  const db = new InMemoryPrismaDatabase();
  db.installOnto(prisma);

  let e2eIpSlot = 1;

  function seedE2EDatabase() {
    memoryCache.clear();
    resetUserFactorySequence();
    resetMemberFactorySequence();

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 2, 10, 0, 0);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 28, 10, 0, 0);
    const threeDaysOut = new Date(now.getTime() + 3 * 86_400_000);

    const admin = buildAdminUser({ branchId: E2E_PRIMARY_BRANCH_ID });
    const superAdmin = buildSuperAdminUser({ branchId: E2E_PRIMARY_BRANCH_ID });
    const trainer = buildStaffUser('TRAINER', { branchId: E2E_PRIMARY_BRANCH_ID });
    const roster = createSequentialMemberRoster();
    const branch2Member = buildMemberPair({
      userId: 'member-branch2-001',
      profileId: 'profile-branch2-001',
      branchId: E2E_SECONDARY_BRANCH_ID,
      memberId: '001',
      firstName: 'Vikram',
      lastName: 'AnnaNagar',
      email: 'vikram.br2@lakzee.test',
    });

    const plan = {
      id: 'plan-e2e-gold',
      branchId: E2E_PRIMARY_BRANCH_ID,
      name: 'Pro Strength',
      description: 'Full studio access',
      price: 3500,
      durationDays: 30,
      gstPercentage: 0,
      isActive: true,
      createdAt: monthStart,
      updatedAt: monthStart,
    };

    const sub001 = {
      id: 'sub-e2e-001',
      branchId: E2E_PRIMARY_BRANCH_ID,
      memberId: roster.find((r) => r.profile.memberId === '001')!.profile.id,
      planId: plan.id,
      startDate: monthStart,
      endDate: nextMonth,
      status: 'ACTIVE',
      paymentStatus: 'PAID',
      paymentMethod: 'UPI',
      balanceAmount: 0,
      createdAt: monthStart,
      updatedAt: monthStart,
    };

    const sub002 = {
      id: 'sub-e2e-002',
      branchId: E2E_PRIMARY_BRANCH_ID,
      memberId: roster.find((r) => r.profile.memberId === '002')!.profile.id,
      planId: plan.id,
      startDate: monthStart,
      endDate: threeDaysOut,
      status: 'ACTIVE',
      paymentStatus: 'PAID',
      paymentMethod: 'CASH',
      balanceAmount: 0,
      createdAt: now,
      updatedAt: now,
    };

    db.reset({
      branches: [
        {
          id: E2E_PRIMARY_BRANCH_ID,
          name: 'Lakzee Primary Studio',
          code: 'BR-001',
          location: 'Main Studio Campus',
          status: 'ACTIVE',
          createdAt: monthStart,
          updatedAt: monthStart,
        },
        {
          id: E2E_SECONDARY_BRANCH_ID,
          name: 'Anna Nagar Branch',
          code: 'BR-002',
          location: 'Chennai West',
          status: 'ACTIVE',
          createdAt: now,
          updatedAt: now,
        },
      ],
      users: [admin, superAdmin, trainer, ...roster.map((r) => r.user), branch2Member.user],
      memberProfiles: [...roster.map((r) => r.profile), branch2Member.profile],
      plans: [plan],
      subscriptions: [sub001, sub002],
      attendances: [
        {
          id: 'att-e2e-1',
          branchId: E2E_PRIMARY_BRANCH_ID,
          memberId: sub001.memberId,
          date: now,
          checkIn: now,
          checkOut: null,
        },
      ],
    });
  }

  seedE2EDatabase();

  const PORT = Number(process.env.PORT || 5055);
  const server = http.createServer((req, res) => {
    if (req.url === '/__test__/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, mode: 'e2e-isolated-memory' }));
      return;
    }

    if (req.url === '/__test__/reset' && req.method === 'POST') {
      e2eIpSlot += 1;
      seedE2EDatabase();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, members: db.memberProfiles.length, slot: e2eIpSlot }));
      return;
    }

    if (req.url === '/__test__/sign-payment' && req.method === 'POST') {
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => {
        try {
          const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as {
            orderId?: string;
            paymentId?: string;
          };
          const orderId = String(parsed.orderId || '');
          const paymentId = String(parsed.paymentId || `pay_e2e_${Date.now()}`);
          const signature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
            .update(`${orderId}|${paymentId}`)
            .digest('hex');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              razorpay_order_id: orderId,
              razorpay_payment_id: paymentId,
              razorpay_signature: signature,
            })
          );
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid payload' }));
        }
      });
      return;
    }

    req.headers['x-forwarded-for'] = `10.240.${Math.floor(e2eIpSlot / 250)}.${(e2eIpSlot % 250) + 1}`;
    app(req, res);
  });

  server.listen(PORT, '127.0.0.1', () => {
    process.stdout.write(`E2E isolated backend listening on http://127.0.0.1:${PORT}\n`);
  });

  process.on('SIGTERM', () => server.close(() => process.exit(0)));
  process.on('SIGINT', () => server.close(() => process.exit(0)));
}

void bootstrapE2EApiServer();
