import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import app, { prisma } from '../../src/app';
import { securityEnv } from '../../src/config/env';
import { memoryCache } from '../../src/utils/cache';
import { generateAccessToken, generateRefreshToken } from '../../src/utils/jwt';
import { InMemoryPrismaDatabase } from '../factories/in-memory-db.factory';
import { buildMemberPair, resetMemberFactorySequence } from '../factories/member.factory';
import {
  buildAdminUser,
  buildStaffUser,
  buildSuperAdminUser,
  DEFAULT_TEST_PASSWORD,
  resetUserFactorySequence,
} from '../factories/user.factory';

function extractSetCookie(setCookie: string[] | string | undefined, name: string): string | null {
  const list = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const entry = list.find((item) => item.startsWith(`${name}=`));
  return entry ? entry.split(';')[0] : null;
}

describe('Auth, JWT Refresh Rotation, RBAC & Validation (Supertest Integration)', () => {
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

    const admin = buildAdminUser();
    const superAdmin = buildSuperAdminUser();
    const trainer = buildStaffUser('TRAINER');
    const member = buildMemberPair({ memberId: '001' });

    db.reset({
      users: [admin, superAdmin, trainer, member.user],
      memberProfiles: [member.profile],
    });
  });

  it('issues Access Token + HttpOnly Refresh cookie on valid admin login and rotates via /refresh', async () => {
    const ip = '198.51.100.11';
    const loginRes = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', ip)
      .send({ email: 'admin@lakzee.fit', password: DEFAULT_TEST_PASSWORD });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.success).toBe(true);
    expect(loginRes.body.data.accessToken).toBeTypeOf('string');
    expect(loginRes.body.data.refreshToken).toBeUndefined();
    expect(loginRes.body.data.user.password).toBeUndefined();

    const setCookieHeader = loginRes.headers['set-cookie'];
    expect(String(setCookieHeader)).toContain('HttpOnly');
    expect(String(setCookieHeader)).toContain('Path=/api/auth');

    const cookie1 = extractSetCookie(setCookieHeader, 'lakzee_refresh_token');
    expect(cookie1).toBeTruthy();

    // Expired access token fails with 401 -> refresh cookie recovers cleanly
    const expiredToken = jwt.sign(
      { id: 'admin-1', role: 'ADMIN', tokenType: 'access' },
      securityEnv.jwtAccessSecret,
      { expiresIn: -5 }
    );
    const expiredAttempt = await request(app)
      .get('/api/members')
      .set('X-Forwarded-For', ip)
      .set('Authorization', `Bearer ${expiredToken}`);
    expect(expiredAttempt.status).toBe(401);

    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .set('X-Forwarded-For', ip)
      .set('Cookie', cookie1!);

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.data.accessToken).toBeTypeOf('string');

    const cookie2 = extractSetCookie(refreshRes.headers['set-cookie'], 'lakzee_refresh_token');
    expect(cookie2).toBeTruthy();
    expect(cookie2).not.toBe(cookie1);

    // New access token works immediately on protected route
    const recoveredAttempt = await request(app)
      .get('/api/members')
      .set('X-Forwarded-For', ip)
      .set('Authorization', `Bearer ${refreshRes.body.data.accessToken}`);
    expect(recoveredAttempt.status).toBe(200);

    // Replaying revoked cookie1 detects reuse & revokes the session family (invalidating cookie2 too)
    const replayAttempt = await request(app)
      .post('/api/auth/refresh')
      .set('X-Forwarded-For', ip)
      .set('Cookie', cookie1!);
    expect(replayAttempt.status).toBe(401);

    const familyRevokedAttempt = await request(app)
      .post('/api/auth/refresh')
      .set('X-Forwarded-For', ip)
      .set('Cookie', cookie2!);
    expect(familyRevokedAttempt.status).toBe(401);
  });

  it('rejects logged-out refresh tokens and clears cookie on POST /api/auth/logout', async () => {
    const ip = '198.51.100.12';
    const loginRes = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', ip)
      .send({ email: 'admin@lakzee.fit', password: DEFAULT_TEST_PASSWORD });

    const refreshCookie = extractSetCookie(loginRes.headers['set-cookie'], 'lakzee_refresh_token')!;
    const logoutRes = await request(app)
      .post('/api/auth/logout')
      .set('X-Forwarded-For', ip)
      .set('Cookie', refreshCookie);

    expect(logoutRes.status).toBe(200);
    expect(String(logoutRes.headers['set-cookie'])).toContain('Expires=Thu, 01 Jan 1970');

    const afterLogout = await request(app)
      .post('/api/auth/refresh')
      .set('X-Forwarded-For', ip)
      .set('Cookie', refreshCookie);
    expect(afterLogout.status).toBe(401);

    // Also ensure completely unknown refresh tokens are rejected
    const forgedRefresh = generateRefreshToken({ id: 'admin-1', role: 'ADMIN' }, 'unknown-jti', 'unknown-fam');
    const forgedAttempt = await request(app)
      .post('/api/auth/refresh')
      .set('X-Forwarded-For', ip)
      .set('Cookie', `lakzee_refresh_token=${forgedRefresh}`);
    expect(forgedAttempt.status).toBe(401);
  });

  it('returns 401 on invalid login credentials and triggers 429 rate-limit after 10 failures', async () => {
    const bruteIp = '198.51.100.77';

    for (let i = 0; i < 10; i++) {
      const badLogin = await request(app)
        .post('/api/auth/login')
        .set('X-Forwarded-For', bruteIp)
        .send({ email: 'admin@lakzee.fit', password: 'WrongPassword!' });
      expect(badLogin.status).toBe(401);
    }

    const rateLimited = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', bruteIp)
      .send({ email: 'admin@lakzee.fit', password: 'WrongPassword!' });
    expect(rateLimited.status).toBe(429);
    expect(rateLimited.body).toMatchObject({
      success: false,
      status: 'error',
      code: 'RATE_LIMITED',
    });
  });

  it('enforces RBAC across unauthenticated, MEMBER, TRAINER, ADMIN & SUPER_ADMIN roles', async () => {
    const ip = '198.51.100.13';
    const memberTok = generateAccessToken({ id: 'member-user-001', role: 'MEMBER' });
    const trainerTok = generateAccessToken({ id: 'trainer-1', role: 'TRAINER' });
    const adminTok = generateAccessToken({ id: 'admin-1', role: 'ADMIN' });
    const superTok = generateAccessToken({ id: 'super-admin-1', role: 'SUPER_ADMIN' });

    const unauth = await request(app).get('/api/dashboard/stats').set('X-Forwarded-For', ip);
    expect(unauth.status).toBe(401);

    const memberForbidden = await request(app)
      .get('/api/dashboard/stats')
      .set('X-Forwarded-For', ip)
      .set('Authorization', `Bearer ${memberTok}`);
    expect(memberForbidden.status).toBe(403);

    const trainerDeleteForbidden = await request(app)
      .delete('/api/members/member-user-001')
      .set('X-Forwarded-For', ip)
      .set('Authorization', `Bearer ${trainerTok}`);
    expect(trainerDeleteForbidden.status).toBe(403);

    const adminEscalateForbidden = await request(app)
      .post('/api/staff/assign')
      .set('X-Forwarded-For', ip)
      .set('Authorization', `Bearer ${adminTok}`)
      .send({ userId: 'trainer-1', role: 'SUPER_ADMIN' });
    expect(adminEscalateForbidden.status).toBe(403);

    const superAdminStaff = await request(app)
      .get('/api/staff')
      .set('X-Forwarded-For', ip)
      .set('Authorization', `Bearer ${superTok}`);
    expect(superAdminStaff.status).toBe(200);
  });

  it('rejects malformed payloads via Zod validation and strips XSS / NoSQL injection payloads', async () => {
    const ip = '198.51.100.14';
    const adminTok = generateAccessToken({ id: 'admin-1', role: 'ADMIN' });

    const invalidPlan = await request(app)
      .post('/api/plans')
      .set('X-Forwarded-For', ip)
      .set('Authorization', `Bearer ${adminTok}`)
      .send({ name: '', price: -25, durationDays: 0 });

    expect(invalidPlan.status).toBe(400);
    expect(invalidPlan.body).toMatchObject({
      success: false,
      status: 'error',
      message: 'Validation failed',
    });

    // Injection attempt inside firstName / extra $gt key must be stripped before persistence
    const createdMember = await request(app)
      .post('/api/members')
      .set('X-Forwarded-For', ip)
      .set('Authorization', `Bearer ${adminTok}`)
      .send({
        firstName: '<script>alert(1)</script>Vikram',
        lastName: 'Das',
        email: 'vikram@lakzee.test',
        password: 'ValidPass!2026',
        $gt: '',
      });

    expect(createdMember.status).toBe(201);
    expect(createdMember.body.data.firstName).toBe('Vikram');
    expect('$gt' in createdMember.body.data).toBe(false);
  });
});
