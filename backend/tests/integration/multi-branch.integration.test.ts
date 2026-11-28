import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import app, { prisma } from '../../src/app';
import { migrateSingleBranchToPrimary } from '../../scripts/migrate-multi-branch';
import { memoryCache } from '../../src/utils/cache';
import { generateAccessToken } from '../../src/utils/jwt';
import { PRIMARY_BRANCH_ID } from '../../src/utils/tenant';
import { InMemoryPrismaDatabase } from '../factories/in-memory-db.factory';
import { buildMemberPair, resetMemberFactorySequence } from '../factories/member.factory';
import {
  buildAdminUser,
  buildSuperAdminUser,
  buildUserRecord,
  resetUserFactorySequence,
} from '../factories/user.factory';

describe('Multi-Branch Tenancy, 403 Cross-Branch Isolation, Migration & Cursor Pagination', () => {
  const db = new InMemoryPrismaDatabase();
  let restoreDb: (() => void) | null = null;

  beforeAll(() => {
    restoreDb = db.installOnto(prisma);
  });

  afterAll(() => {
    restoreDb?.();
  });

  beforeEach(() => {
    memoryCache.clear();
    resetUserFactorySequence();
    resetMemberFactorySequence();
  });

  it('migrates legacy unbranched single-studio records to Branch #1 idempotently with zero data loss', async () => {
    const legacyAdmin = { ...buildAdminUser({ id: 'legacy-admin' }), branchId: null };
    const legacyMember = buildMemberPair({ memberId: '001', branchId: null });
    legacyMember.user.branchId = null;
    legacyMember.profile.branchId = null;

    db.reset({
      branches: [],
      users: [legacyAdmin, legacyMember.user],
      memberProfiles: [legacyMember.profile],
      plans: [
        {
          id: 'plan-legacy-1',
          branchId: null,
          name: 'Legacy Annual',
          description: null,
          price: 9999,
          durationDays: 365,
          gstPercentage: 18,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });

    const firstRun = await migrateSingleBranchToPrimary(prisma);
    expect(firstRun.branchId).toBe(PRIMARY_BRANCH_ID);
    expect(db.branches).toHaveLength(1);
    expect(db.branches[0].code).toBe('BR-001');
    expect(db.users.every((u) => u.branchId === PRIMARY_BRANCH_ID)).toBe(true);
    expect(db.memberProfiles[0].memberId).toBe('001');
    expect(db.memberProfiles[0].branchId).toBe(PRIMARY_BRANCH_ID);

    // Re-running migration is a safe idempotent no-op
    const secondRun = await migrateSingleBranchToPrimary(prisma);
    expect(secondRun.backfilledCounts.users).toBe(0);
    expect(db.branches).toHaveLength(1);
  });

  it('strictly isolates Branch A & Branch B (403 on cross-branch access), scopes ID sequencing, and lets SUPER_ADMIN switch globally', async () => {
    const branchBId = 'branch-b-anna-nagar';
    const now = new Date();
    const superAdmin = buildSuperAdminUser();
    const branchAAdmin = buildUserRecord({
      id: 'branch-admin-a',
      email: 'admin.a@lakzee.fit',
      role: 'BRANCH_ADMIN',
      branchId: PRIMARY_BRANCH_ID,
    });
    const branchBAdmin = buildUserRecord({
      id: 'branch-admin-b',
      email: 'admin.b@lakzee.fit',
      role: 'BRANCH_ADMIN',
      branchId: branchBId,
    });

    // Both branches independently start Member ID sequences at 001
    const memberA1 = buildMemberPair({
      userId: 'user-a-001',
      profileId: 'prof-a-001',
      memberId: '001',
      branchId: PRIMARY_BRANCH_ID,
      firstName: 'Arjun',
      lastName: 'BranchA',
      email: 'arjun.a@lakzee.test',
    });
    const memberB1 = buildMemberPair({
      userId: 'user-b-001',
      profileId: 'prof-b-001',
      memberId: '001',
      qrCode: 'QR-BRANCH-B-001',
      branchId: branchBId,
      firstName: 'Kiran',
      lastName: 'BranchB',
      email: 'kiran.b@lakzee.test',
    });

    db.reset({
      branches: [
        {
          id: PRIMARY_BRANCH_ID,
          name: 'Lakzee Primary Studio',
          code: 'BR-001',
          location: 'Main Campus',
          status: 'ACTIVE',
          createdAt: now,
          updatedAt: now,
        },
        {
          id: branchBId,
          name: 'Anna Nagar Studio',
          code: 'BR-002',
          location: 'Anna Nagar West',
          status: 'ACTIVE',
          createdAt: now,
          updatedAt: now,
        },
      ],
      users: [superAdmin, branchAAdmin, branchBAdmin, memberA1.user, memberB1.user],
      memberProfiles: [memberA1.profile, memberB1.profile],
    });

    const tokA = generateAccessToken({ id: branchAAdmin.id, role: 'BRANCH_ADMIN', branchId: PRIMARY_BRANCH_ID });
    const tokB = generateAccessToken({ id: branchBAdmin.id, role: 'BRANCH_ADMIN', branchId: branchBId });
    const tokSuper = generateAccessToken({ id: superAdmin.id, role: 'SUPER_ADMIN', branchId: PRIMARY_BRANCH_ID });
    const ip = '198.51.100.200';

    // 1. Branch A lists only Branch A; Branch B lists only Branch B
    const listA = await request(app)
      .get('/api/members')
      .set('X-Forwarded-For', ip)
      .set('Authorization', `Bearer ${tokA}`);
    expect(listA.status).toBe(200);
    expect(listA.body.data.map((m: { id: string }) => m.id)).toEqual(['user-a-001']);

    const listB = await request(app)
      .get('/api/members')
      .set('X-Forwarded-For', ip)
      .set('Authorization', `Bearer ${tokB}`);
    expect(listB.status).toBe(200);
    expect(listB.body.data.map((m: { id: string }) => m.id)).toEqual(['user-b-001']);

    // 2. Branch A Admin attempting to access Branch B data receives HTTP 403 across endpoints
    const crossQueryRes = await request(app)
      .get(`/api/members?branchId=${branchBId}`)
      .set('X-Forwarded-For', ip)
      .set('Authorization', `Bearer ${tokA}`);
    expect(crossQueryRes.status).toBe(403);

    const crossHeaderRes = await request(app)
      .get('/api/dashboard/stats')
      .set('X-Forwarded-For', ip)
      .set('X-Branch-Id', branchBId)
      .set('Authorization', `Bearer ${tokA}`);
    expect(crossHeaderRes.status).toBe(403);

    const crossSingleGet = await request(app)
      .get(`/api/members/${memberB1.user.id}`)
      .set('X-Forwarded-For', ip)
      .set('Authorization', `Bearer ${tokA}`);
    expect(crossSingleGet.status).toBe(403);

    const crossUpdate = await request(app)
      .put(`/api/members/${memberB1.user.id}`)
      .set('X-Forwarded-For', ip)
      .set('Authorization', `Bearer ${tokA}`)
      .send({ firstName: 'Hijacked' });
    expect(crossUpdate.status).toBe(403);

    const crossDelete = await request(app)
      .delete(`/api/members/${memberB1.user.id}`)
      .set('X-Forwarded-For', ip)
      .set('Authorization', `Bearer ${tokA}`);
    expect(crossDelete.status).toBe(403);

    const crossCheckin = await request(app)
      .post('/api/attendance/checkin')
      .set('X-Forwarded-For', ip)
      .set('Authorization', `Bearer ${tokA}`)
      .send({ lakzeeId: 'QR-BRANCH-B-001' });
    expect(crossCheckin.status).toBe(403);

    const crossBranchInfo = await request(app)
      .get(`/api/branches/${branchBId}`)
      .set('X-Forwarded-For', ip)
      .set('Authorization', `Bearer ${tokA}`);
    expect(crossBranchInfo.status).toBe(403);

    // 3. Adding a new member inside Branch B sequences to 002 independently of Branch A
    const createInB = await request(app)
      .post('/api/members')
      .set('X-Forwarded-For', ip)
      .set('Authorization', `Bearer ${tokB}`)
      .send({
        firstName: 'Divya',
        lastName: 'BranchBTwo',
        email: 'divya.b2@lakzee.test',
        password: 'StrongPassword!2026',
      });
    expect(createInB.status).toBe(201);
    expect(createInB.body.data.branchId).toBe(branchBId);
    expect(createInB.body.data.memberProfile.memberId).toBe('002');

    // 4. SUPER_ADMIN can create a 3rd branch, inspect Global aggregated stats, and switch branches via X-Branch-Id
    const createdBranchC = await request(app)
      .post('/api/branches')
      .set('X-Forwarded-For', ip)
      .set('Authorization', `Bearer ${tokSuper}`)
      .send({ name: 'Velachery Box', location: 'Velachery Chennai' });
    expect(createdBranchC.status).toBe(201);
    expect(createdBranchC.body.data.code).toBe('BR-003');

    const superGlobalMembers = await request(app)
      .get('/api/members')
      .set('X-Forwarded-For', ip)
      .set('Authorization', `Bearer ${tokSuper}`);
    expect(superGlobalMembers.status).toBe(200);
    expect(superGlobalMembers.body.data).toHaveLength(3);
    expect(superGlobalMembers.body.meta.branchId).toBe('all');

    const superSwitchedToB = await request(app)
      .get('/api/members')
      .set('X-Forwarded-For', ip)
      .set('X-Branch-Id', branchBId)
      .set('Authorization', `Bearer ${tokSuper}`);
    expect(superSwitchedToB.status).toBe(200);
    expect(superSwitchedToB.body.meta.branchId).toBe(branchBId);
    expect(superSwitchedToB.body.data).toHaveLength(2);
  });

  it('supports deterministic server-side cursor pagination across large branch rosters without skipping rows', async () => {
    const admin = buildAdminUser();
    const members = ['001', '002', '003', '004', '005'].map((num) =>
      buildMemberPair({
        userId: `u-page-${num}`,
        memberId: num,
        branchId: PRIMARY_BRANCH_ID,
      })
    );

    db.reset({
      users: [admin, ...members.map((m) => m.user)],
      memberProfiles: members.map((m) => m.profile),
    });

    const tok = generateAccessToken({ id: admin.id, role: 'ADMIN', branchId: PRIMARY_BRANCH_ID });
    const ip = '198.51.100.201';

    const page1 = await request(app)
      .get('/api/members?sort=asc&limit=2')
      .set('X-Forwarded-For', ip)
      .set('Authorization', `Bearer ${tok}`);
    expect(page1.status).toBe(200);
    expect(page1.body.data.map((m: { memberProfile: { memberId: string } }) => m.memberProfile.memberId)).toEqual([
      '001',
      '002',
    ]);
    expect(page1.body.meta).toMatchObject({ total: 5, limit: 2, hasMore: true });
    expect(page1.body.meta.nextCursor).toBe('u-page-002');

    const page2 = await request(app)
      .get(`/api/members?sort=asc&limit=2&cursor=${page1.body.meta.nextCursor}`)
      .set('X-Forwarded-For', ip)
      .set('Authorization', `Bearer ${tok}`);
    expect(page2.status).toBe(200);
    expect(page2.body.data.map((m: { memberProfile: { memberId: string } }) => m.memberProfile.memberId)).toEqual([
      '003',
      '004',
    ]);
    expect(page2.body.meta).toMatchObject({ total: 5, limit: 2, hasMore: true, nextCursor: 'u-page-004' });

    const page3 = await request(app)
      .get(`/api/members?sort=asc&limit=2&cursor=${page2.body.meta.nextCursor}`)
      .set('X-Forwarded-For', ip)
      .set('Authorization', `Bearer ${tok}`);
    expect(page3.status).toBe(200);
    expect(page3.body.data.map((m: { memberProfile: { memberId: string } }) => m.memberProfile.memberId)).toEqual([
      '005',
    ]);
    expect(page3.body.meta).toMatchObject({ total: 5, limit: 2, hasMore: false, nextCursor: null });
  });
});
