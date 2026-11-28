import '../setup';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryPrismaDatabase } from '../factories/in-memory-db.factory';
import { buildMemberPair } from '../factories/member.factory';
import {
  buildAdminUser,
  buildSuperAdminUser,
  DEFAULT_TEST_PASSWORD,
} from '../factories/user.factory';
import { NotificationService } from '../../src/services/notification.service';
import { NotificationRepository } from '../../src/repositories/notification.repository';
import { PermanentDeliveryError } from '../../src/services/notifications/retry';

describe('Automated Expiry Reminders: Idempotency, Opt-Out, Retries, Multi-Branch & Cron Security', () => {
  let app: any;
  let prisma: any;
  let memoryCache: any;
  const db = new InMemoryPrismaDatabase();
  let uninstallDb: (() => void) | null = null;
  let adminTokenA = '';
  let superToken = '';

  const seedReminderScenario = () => {
    const now = new Date();
    const daysFromNowUtc = (d: number) => new Date(now.getTime() + d * 86_400_000);

    const adminA = buildAdminUser({
      id: 'admin-branch-a',
      email: 'admin.a@lakzee.test',
      branchId: 'branch-a',
    });
    const superAdmin = buildSuperAdminUser({
      id: 'super-admin-1',
      email: 'owner.rem@lakzee.test',
      branchId: 'branch-a',
    });

    // Branch A member expiring in 3 days (opted IN, has WhatsApp + Email)
    const m3Days = buildMemberPair({
      userId: 'u-m3d',
      profileId: 'mp-m3d',
      branchId: 'branch-a',
      memberId: '001',
      firstName: 'Kiran',
      lastName: 'ThreeDays',
      email: 'kiran3d@lakzee.test',
      phone: '+919876543211',
    });
    m3Days.profile.whatsappNumber = '+919876543211';
    m3Days.profile.notificationsEnabled = true;

    // Branch A member expiring today (opted OUT!)
    const mOptOut = buildMemberPair({
      userId: 'u-optout',
      profileId: 'mp-optout',
      branchId: 'branch-a',
      memberId: '002',
      firstName: 'Sita',
      lastName: 'OptedOut',
      email: 'sita.optout@lakzee.test',
      phone: '+919876543212',
    });
    mOptOut.profile.whatsappNumber = '+919876543212';
    mOptOut.profile.notificationsEnabled = false;

    // Branch B member expiring in 7 days (strictly isolated from Branch A admin)
    const mBranchB = buildMemberPair({
      userId: 'u-brb',
      profileId: 'mp-brb',
      branchId: 'branch-b',
      memberId: '001',
      firstName: 'Vikram',
      lastName: 'BranchB',
      email: 'vikram.brb@lakzee.test',
      phone: '+919876543213',
    });
    mBranchB.profile.whatsappNumber = '+919876543213';
    mBranchB.profile.notificationsEnabled = true;

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
      users: [adminA, superAdmin, m3Days.user, mOptOut.user, mBranchB.user],
      memberProfiles: [m3Days.profile, mOptOut.profile, mBranchB.profile],
      plans: [
        {
          id: 'plan-a',
          branchId: 'branch-a',
          name: 'Quarterly Shred',
          description: null,
          price: 3999,
          durationDays: 90,
          gstPercentage: 18,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        },
      ],
      subscriptions: [
        {
          id: 'sub-3d',
          branchId: 'branch-a',
          memberId: 'mp-m3d',
          planId: 'plan-a',
          startDate: daysFromNowUtc(-87),
          endDate: daysFromNowUtc(3),
          status: 'ACTIVE',
          paymentStatus: 'PAID',
          paymentMethod: 'UPI',
          balanceAmount: 0,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'sub-optout',
          branchId: 'branch-a',
          memberId: 'mp-optout',
          planId: 'plan-a',
          startDate: daysFromNowUtc(-30),
          endDate: now,
          status: 'ACTIVE',
          paymentStatus: 'PAID',
          paymentMethod: 'CASH',
          balanceAmount: 0,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'sub-brb',
          branchId: 'branch-b',
          memberId: 'mp-brb',
          planId: 'plan-a',
          startDate: daysFromNowUtc(-23),
          endDate: daysFromNowUtc(7),
          status: 'ACTIVE',
          paymentStatus: 'PAID',
          paymentMethod: 'UPI',
          balanceAmount: 0,
          createdAt: now,
          updatedAt: now,
        },
      ],
    });
  };

  beforeAll(async () => {
    process.env.DRY_RUN = 'true';
    process.env.CRON_SECRET = 'test-cron-secret-value';
    const [appModule, cacheModule] = await Promise.all([
      import('../../src/app'),
      import('../../src/utils/cache'),
    ]);
    app = appModule.default;
    prisma = appModule.prisma;
    memoryCache = cacheModule.memoryCache;
    uninstallDb = db.installOnto(prisma);
  });

  afterAll(() => {
    uninstallDb?.();
  });

  beforeEach(async () => {
    memoryCache.clear();
    seedReminderScenario();

    const [loginA, loginSuper] = await Promise.all([
      request(app).post('/api/auth/login').send({ email: 'admin.a@lakzee.test', password: DEFAULT_TEST_PASSWORD }),
      request(app).post('/api/auth/login').send({ email: 'owner.rem@lakzee.test', password: DEFAULT_TEST_PASSWORD }),
    ]);
    adminTokenA = loginA.body.data.accessToken;
    superToken = loginSuper.body.data.accessToken;
  });

  it('guarantees zero duplicates across repeated cron executions, skips opted-out members, and requires valid X-Cron-Secret', async () => {
    // Missing/bad cron secret rejected
    const missingSecret = await request(app).post('/api/cron/expiry-reminders').send({ dryRun: true });
    expect(missingSecret.status).toBe(401);

    const wrongSecret = await request(app)
      .post('/api/cron/expiry-reminders')
      .set('X-Cron-Secret', 'wrong-secret')
      .send({ dryRun: true });
    expect(wrongSecret.status).toBe(403);

    // First cron trigger dispatches WHATSAPP + EMAIL for mp-m3d (3_DAYS) & mp-brb (7_DAYS) = 4 sent, skips opt-out = 1
    const firstRun = await request(app)
      .post('/api/cron/expiry-reminders')
      .set('X-Cron-Secret', 'test-cron-secret-value')
      .send({ dryRun: true });

    expect(firstRun.status).toBe(200);
    expect(firstRun.body.data.sent).toBe(4);
    expect(firstRun.body.data.skippedOptOut).toBe(1);
    expect(firstRun.body.data.skippedDuplicate).toBe(0);

    // Second immediate run -> strict DB unique idempotency sends 0 new messages
    const secondRun = await request(app)
      .post('/api/cron/expiry-reminders')
      .set('X-Cron-Secret', 'test-cron-secret-value')
      .send({ dryRun: true });

    expect(secondRun.status).toBe(200);
    expect(secondRun.body.data.sent).toBe(0);
    expect(secondRun.body.data.skippedDuplicate).toBe(4);
    expect(secondRun.body.data.skippedOptOut).toBe(1);
  });

  it('enforces branch isolation on reminder logs, manual send, and retry while logging FAILED -> SENT transitions', async () => {
    const customService = new NotificationService(new NotificationRepository(prisma));
    const failingWa = {
      providerName: 'mock-fail-wa',
      isConfigured: () => true,
      sendTemplateReminder: vi.fn().mockRejectedValue(new PermanentDeliveryError('Template rejected', 400)),
    };
    const healthyEmail = {
      providerName: 'mock-ok-email',
      isConfigured: () => true,
      sendReminderEmail: vi.fn().mockResolvedValue({
        status: 'SENT' as const,
        provider: 'mock-ok-email',
        providerMessageId: 'msg-ok-1',
      }),
    };

    // Execute batch with failing WhatsApp adapter
    const batch = await customService.runExpiryReminderBatch({
      branchId: 'branch-a',
      batchDelayMs: 0,
      whatsappAdapter: failingWa,
      emailAdapter: healthyEmail,
    });
    expect(batch.failed).toBe(1);
    expect(batch.sent).toBe(1);

    // Branch A admin sees only Branch A logs and can trigger manual retry on the FAILED entry
    const logsResA = await request(app)
      .get('/api/notifications/logs')
      .set('Authorization', `Bearer ${adminTokenA}`);
    expect(logsResA.status).toBe(200);
    expect(logsResA.body.data.length).toBe(2);
    const failedEntry = logsResA.body.data.find((l: any) => l.status === 'FAILED');
    expect(failedEntry).toBeDefined();

    // Retry failed log via API (uses DRY_RUN=true healthy adapter -> becomes SENT)
    const retryRes = await request(app)
      .post(`/api/notifications/logs/${failedEntry.id}/retry`)
      .set('Authorization', `Bearer ${adminTokenA}`)
      .send({ dryRun: true });
    expect(retryRes.status).toBe(200);
    expect(retryRes.body.data.status).toBe('SENT');

    // Manual send to opted-out member in Branch A returns 400
    const optOutSend = await request(app)
      .post('/api/notifications/send')
      .set('Authorization', `Bearer ${adminTokenA}`)
      .send({ memberId: 'mp-optout', dryRun: true });
    expect(optOutSend.status).toBe(400);

    // Cross-branch isolation: Branch A admin blocked 403 when targeting Branch B member
    const crossBranchSend = await request(app)
      .post('/api/notifications/send')
      .set('Authorization', `Bearer ${adminTokenA}`)
      .send({ memberId: 'mp-brb', dryRun: true });
    expect(crossBranchSend.status).toBe(403);

    // SUPER_ADMIN can disable WhatsApp reminders exclusively for Branch B via Settings
    const disableBrB = await request(app)
      .put('/api/settings')
      .set('Authorization', `Bearer ${superToken}`)
      .set('X-Branch-Id', 'branch-b')
      .send({
        whatsappRemindersEnabled: false,
        emailRemindersEnabled: true,
        reminderMilestones: '7,1,0',
      });
    expect(disableBrB.status).toBe(200);
    expect(disableBrB.body.data.whatsappRemindersEnabled).toBe(false);

    // Triggering batch globally respects Branch B disabled WhatsApp (sends Email only for Branch B!)
    const superRun = await request(app)
      .post('/api/notifications/run')
      .set('Authorization', `Bearer ${superToken}`)
      .set('X-Branch-Id', 'branch-b')
      .send({ dryRun: true });
    expect(superRun.status).toBe(200);
    expect(superRun.body.data.sent).toBe(1);
    expect(superRun.body.data.skippedChannelDisabled).toBe(1);
  });
});
