import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import app, { prisma } from '../../src/app';
import { memoryCache } from '../../src/utils/cache';
import { generateAccessToken } from '../../src/utils/jwt';
import { InMemoryPrismaDatabase } from '../factories/in-memory-db.factory';
import { createSequentialMemberRoster, resetMemberFactorySequence } from '../factories/member.factory';
import { buildAdminUser, resetUserFactorySequence } from '../factories/user.factory';

describe('Members CRUD, Sequential ID Allocation, Sorting & Cache Invalidation (Supertest)', () => {
  const db = new InMemoryPrismaDatabase();
  let restoreDb: (() => void) | null = null;
  let adminToken = '';

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

    const admin = buildAdminUser();
    const roster = createSequentialMemberRoster();
    db.reset({
      users: [admin, ...roster.map((r) => r.user)],
      memberProfiles: roster.map((r) => r.profile),
    });

    adminToken = generateAccessToken({ id: admin.id, role: admin.role });
  });

  it('GET /api/members defaults to natural ascending order (001->002->010->011) and supports desc/latest', async () => {
    const ip = '198.51.100.21';

    const defaultAsc = await request(app)
      .get('/api/members')
      .set('X-Forwarded-For', ip)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(defaultAsc.status).toBe(200);
    expect(defaultAsc.body.meta).toMatchObject({ sort: 'asc', cached: false });
    expect(defaultAsc.body.data.map((m: { memberProfile: { memberId: string } }) => m.memberProfile.memberId)).toEqual([
      '001',
      '002',
      '010',
      '011',
    ]);

    // Repeat GET hits memory cache
    const cachedAsc = await request(app)
      .get('/api/members?sort=asc')
      .set('X-Forwarded-For', ip)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(cachedAsc.status).toBe(200);
    expect(cachedAsc.body.meta.cached).toBe(true);

    const descRes = await request(app)
      .get('/api/members?sort=desc')
      .set('X-Forwarded-For', ip)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(descRes.status).toBe(200);
    expect(descRes.body.data.map((m: { memberProfile: { memberId: string } }) => m.memberProfile.memberId)).toEqual([
      '011',
      '010',
      '002',
      '001',
    ]);

    const latestRes = await request(app)
      .get('/api/members?sort=latest')
      .set('X-Forwarded-For', ip)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(latestRes.status).toBe(200);
    expect(latestRes.body.data.map((m: { memberProfile: { memberId: string } }) => m.memberProfile.memberId)).toEqual([
      '011',
      '010',
      '002',
      '001',
    ]);
  });

  it('POST /api/members assigns next sequential ID (012), invalidates cache & appends at bottom of default list', async () => {
    const ip = '198.51.100.22';

    // Warm read cache first
    const warmed = await request(app)
      .get('/api/members')
      .set('X-Forwarded-For', ip)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(warmed.body.meta.cached).toBe(false);

    const createRes = await request(app)
      .post('/api/members')
      .set('X-Forwarded-For', ip)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName: 'Nisha',
        lastName: 'Twelve',
        email: 'nisha.012@lakzee.test',
        password: 'StrongPassword!2026',
        gender: 'FEMALE',
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.data.memberProfile.memberId).toBe('012');

    // Read cache must be invalidated automatically and new member appears last in asc order
    const afterCreateAsc = await request(app)
      .get('/api/members')
      .set('X-Forwarded-For', ip)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(afterCreateAsc.body.meta.cached).toBe(false);
    expect(
      afterCreateAsc.body.data.map((m: { memberProfile: { memberId: string } }) => m.memberProfile.memberId)
    ).toEqual(['001', '002', '010', '011', '012']);
  });

  it('PUT and DELETE /api/members/:id immediately invalidate backend read caches', async () => {
    const ip = '198.51.100.23';

    // Warm all cache keys (asc + desc + dashboard)
    await request(app)
      .get('/api/members')
      .set('X-Forwarded-For', ip)
      .set('Authorization', `Bearer ${adminToken}`);
    await request(app)
      .get('/api/members?sort=desc')
      .set('X-Forwarded-For', ip)
      .set('Authorization', `Bearer ${adminToken}`);

    const cachedBeforeEdit = await request(app)
      .get('/api/members')
      .set('X-Forwarded-For', ip)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(cachedBeforeEdit.body.meta.cached).toBe(true);

    const updateRes = await request(app)
      .put('/api/members/member-user-002')
      .set('X-Forwarded-For', ip)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ firstName: 'MeeraUpdated', memberId: '015' });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.firstName).toBe('MeeraUpdated');
    expect(updateRes.body.data.memberProfile.memberId).toBe('015');

    const afterEdit = await request(app)
      .get('/api/members')
      .set('X-Forwarded-For', ip)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(afterEdit.body.meta.cached).toBe(false);
    expect(afterEdit.body.data.map((m: { memberProfile: { memberId: string } }) => m.memberProfile.memberId)).toEqual([
      '001',
      '010',
      '011',
      '015',
    ]);

    // Warm cache again, then delete 010 and assert immediate invalidation
    await request(app)
      .get('/api/members')
      .set('X-Forwarded-For', ip)
      .set('Authorization', `Bearer ${adminToken}`);

    const deleteRes = await request(app)
      .delete('/api/members/member-user-010')
      .set('X-Forwarded-For', ip)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(deleteRes.status).toBe(200);

    const afterDelete = await request(app)
      .get('/api/members')
      .set('X-Forwarded-For', ip)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(afterDelete.body.meta.cached).toBe(false);
    expect(afterDelete.body.data.map((m: { memberProfile: { memberId: string } }) => m.memberProfile.memberId)).toEqual([
      '001',
      '011',
      '015',
    ]);
  });
});
