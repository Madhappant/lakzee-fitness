import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import app, { prisma } from '../../src/app';
import { auditService } from '../../src/services/audit.service';
import { alertManager } from '../../src/utils/alerts';
import { memoryCache } from '../../src/utils/cache';
import { errorTracker } from '../../src/utils/error-tracker';
import { generateAccessToken } from '../../src/utils/jwt';
import { telemetry } from '../../src/utils/telemetry';
import { InMemoryPrismaDatabase } from '../factories/in-memory-db.factory';
import { buildMemberPair, resetMemberFactorySequence } from '../factories/member.factory';
import {
  buildAdminUser,
  buildStaffUser,
  DEFAULT_TEST_PASSWORD,
  resetUserFactorySequence,
} from '../factories/user.factory';

describe('Observability Integration: AuditLog, /api/metrics, Telemetry Sink & Error Capture', () => {
  const db = new InMemoryPrismaDatabase();
  let restoreDb: (() => void) | null = null;
  let adminToken = '';
  let memberToken = '';

  beforeAll(() => {
    restoreDb = db.installOnto(prisma);
  });

  afterAll(() => {
    restoreDb?.();
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    memoryCache.clear();
    memoryCache.resetStats();
    telemetry.reset();
    alertManager.reset();
    errorTracker.reset();
    resetUserFactorySequence();
    resetMemberFactorySequence();

    const admin = buildAdminUser();
    const staff = buildStaffUser('TRAINER');
    const member = buildMemberPair({ memberId: '001' });

    db.reset({
      users: [admin, staff, member.user],
      memberProfiles: [member.profile],
    });

    adminToken = generateAccessToken({ id: admin.id, role: admin.role });
    memberToken = generateAccessToken({ id: member.user.id, role: 'MEMBER' });
  });

  it('records immutable AuditLog events across admin login, failed login & member/role mutations', async () => {
    const ip = '198.51.100.81';

    // Failed login -> LOGIN_FAILED audit entry without plaintext password
    const badLogin = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', ip)
      .send({ email: 'admin@lakzee.fit', password: 'WrongPassword!' });
    expect(badLogin.status).toBe(401);

    // Valid Admin login -> ADMIN_LOGIN audit entry
    const goodLogin = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', ip)
      .send({ email: 'admin@lakzee.fit', password: DEFAULT_TEST_PASSWORD });
    expect(goodLogin.status).toBe(200);

    // Member CRUD -> MEMBER_CREATED, MEMBER_UPDATED, MEMBER_DELETED
    const created = await request(app)
      .post('/api/members')
      .set('X-Forwarded-For', ip)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName: 'Nisha',
        lastName: 'Audit',
        email: 'nisha.audit@lakzee.test',
        password: 'StrongPassword!2026',
      });
    expect(created.status).toBe(201);
    const createdUserId = created.body.data.id;

    const updated = await request(app)
      .put(`/api/members/${createdUserId}`)
      .set('X-Forwarded-For', ip)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ firstName: 'NishaEdited' });
    expect(updated.status).toBe(200);

    const roleUpdated = await request(app)
      .post('/api/staff/assign')
      .set('X-Forwarded-For', ip)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: 'trainer-1', role: 'RECEPTIONIST' });
    expect(roleUpdated.status).toBe(200);

    const removed = await request(app)
      .delete(`/api/members/${createdUserId}`)
      .set('X-Forwarded-For', ip)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(removed.status).toBe(200);

    await auditService.flush();

    const actions = db.auditLogs.map((entry) => entry.action);
    expect(actions).toContain('LOGIN_FAILED');
    expect(actions).toContain('ADMIN_LOGIN');
    expect(actions).toContain('MEMBER_CREATED');
    expect(actions).toContain('MEMBER_UPDATED');
    expect(actions).toContain('ROLE_CHANGED');
    expect(actions).toContain('MEMBER_DELETED');

    const createdLog = db.auditLogs.find((e) => e.action === 'MEMBER_CREATED');
    expect(createdLog.actorId).toBe('admin-1');
    expect(createdLog.actorRole).toBe('ADMIN');
    expect(createdLog.targetId).toBe(createdUserId);
    expect(createdLog.ipAddress).toBe(ip);

    // Ensure no passwords or secrets landed in audit metadata
    const serializedAll = JSON.stringify(db.auditLogs);
    expect(serializedAll).not.toContain('StrongPassword!2026');
    expect(serializedAll).not.toContain('WrongPassword!');
    expect(serializedAll).not.toContain('nisha.audit@lakzee.test');
  });

  it('guards GET /api/metrics with Admin RBAC and aggregates APM, cache, Web Vitals & analytics', async () => {
    const ip = '198.51.100.82';

    const unauth = await request(app).get('/api/metrics').set('X-Forwarded-For', ip);
    expect(unauth.status).toBe(401);

    const memberForbidden = await request(app)
      .get('/api/metrics')
      .set('X-Forwarded-For', ip)
      .set('Authorization', `Bearer ${memberToken}`);
    expect(memberForbidden.status).toBe(403);

    // Populate Web Vitals + Frontend Error + Member API traffic
    await request(app)
      .post('/api/telemetry/client')
      .set('X-Forwarded-For', ip)
      .send({ type: 'web-vital', name: 'LCP', value: 1120, rating: 'good', route: '/admin/members' });
    await request(app)
      .post('/api/telemetry/client')
      .set('X-Forwarded-For', ip)
      .send({ type: 'web-vital', name: 'INP', value: 84, rating: 'good', route: '/admin/members' });
    await request(app)
      .post('/api/telemetry/client')
      .set('X-Forwarded-For', ip)
      .send({ type: 'error', route: '/admin/members', message: 'ChunkLoadError for user@lakzee.fit' });

    await request(app)
      .get('/api/members')
      .set('X-Forwarded-For', ip)
      .set('Authorization', `Bearer ${adminToken}`);

    const metricsRes = await request(app)
      .get('/api/metrics')
      .set('X-Forwarded-For', ip)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(metricsRes.status).toBe(200);
    expect(metricsRes.body.data.apm.totalRequests).toBeGreaterThanOrEqual(1);
    expect(typeof metricsRes.body.data.apm.p95Ms).toBe('number');
    expect(typeof metricsRes.body.data.cache.hitRatePercent).toBe('number');
    expect(metricsRes.body.data.webVitals.lcp.p75).toBe(1120);
    expect(metricsRes.body.data.webVitals.inp.p75).toBe(84);
    expect(metricsRes.body.data.webVitals.frontendErrorCount).toBe(1);
    expect(metricsRes.body.data.recentErrors[0].message).toBe('ChunkLoadError for [REDACTED_EMAIL]');
    expect(metricsRes.body.data.analytics).toMatchObject({
      dailyActiveAdminSessions: expect.any(Number),
      memberGrowthVelocity: {
        last30Days: expect.any(Number),
      },
      renewalExpirationTrends: {
        activeSubscriptions: expect.any(Number),
      },
    });
  });

  it('captures controlled 5xx database exception cleanly without leaking stack or credentials', async () => {
    const ip = '198.51.100.83';
    const prevNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const originalFindMany = prisma.user.findMany;
    Object.defineProperty(prisma.user, 'findMany', {
      value: async () => {
        throw new Error('Synthetic DB timeout for testadmin@lakzee.fit');
      },
      writable: true,
      configurable: true,
    });

    try {
      const boomRes = await request(app)
        .get('/api/members')
        .set('X-Forwarded-For', ip)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(boomRes.status).toBe(500);
      expect(boomRes.body.message).toBe('Internal server error');
      expect(boomRes.body.stack).toBeUndefined();

      await errorTracker.flush();
      const captured = errorTracker.getRecentCapturedErrors(5);
      expect(captured.length).toBeGreaterThanOrEqual(1);
      expect(captured[0].message).toBe('Synthetic DB timeout for [REDACTED_EMAIL]');
      expect(captured[0].statusCode).toBe(500);
    } finally {
      Object.defineProperty(prisma.user, 'findMany', {
        value: originalFindMany,
        writable: true,
        configurable: true,
      });
      process.env.NODE_ENV = prevNodeEnv;
    }
  });
});
