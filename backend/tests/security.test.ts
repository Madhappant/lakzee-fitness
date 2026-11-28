/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { Duplex } from 'node:stream';
import bcrypt from 'bcryptjs';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://isolated_test:isolated_test@127.0.0.1:5432/lakzee_isolated_test?schema=public';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'unit-test-secret-lakzee-access';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'unit-test-secret-lakzee-refresh';

let app: any;
let prisma: any;
let memoryCache: any;
let generateAccessToken: any;
let generateRefreshToken: any;
let sanitizePayload: any;

class SecTestSocket extends Duplex {
  readonly chunks: Buffer[] = [];
  remoteAddress = '127.0.0.1';
  _read() {}
  _write(chunk: any, _enc: BufferEncoding, cb: (err?: Error | null) => void) {
    this.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    cb();
  }
  setTimeout() { return this; }
  setNoDelay() { return this; }
  destroy() { return this; }
}

async function dispatchSec(
  url: string,
  options: { method?: string; headers?: Record<string, string>; body?: unknown; rawBody?: string; ip?: string } = {}
) {
  const socket = new SecTestSocket();
  if (options.ip) socket.remoteAddress = options.ip;
  const req = new http.IncomingMessage(socket as any);
  req.method = options.method ?? 'GET';
  req.url = url;
  req.headers = { host: '127.0.0.1', 'accept-encoding': 'identity' };
  for (const [k, v] of Object.entries(options.headers ?? {})) {
    req.headers[k.toLowerCase()] = v;
  }

  if (options.rawBody !== undefined) {
    const buf = Buffer.from(options.rawBody, 'utf8');
    req.headers['content-type'] = req.headers['content-type'] || 'application/json';
    req.headers['content-length'] = String(buf.length);
    req.push(buf);
  } else if (options.body !== undefined) {
    const buf = Buffer.from(JSON.stringify(options.body), 'utf8');
    req.headers['content-type'] = req.headers['content-type'] || 'application/json';
    req.headers['content-length'] = String(buf.length);
    req.push(buf);
  }
  req.push(null);

  const res = new http.ServerResponse(req);
  res.assignSocket(socket as any);
  await new Promise<void>((resolve, reject) => {
    res.once('error', reject);
    res.once('finish', resolve);
    app(req, res);
  });

  const raw = Buffer.concat(socket.chunks);
  const boundary = raw.indexOf('\r\n\r\n');
  const body = (boundary >= 0 ? raw.subarray(boundary + 4) : raw).toString('utf8');
  let json: any = null;
  try {
    json = body ? JSON.parse(body) : null;
  } catch {
    json = body;
  }
  return { status: res.statusCode, headers: res.getHeaders(), json };
}

function mockMethod(t: any, target: any, methodName: string, impl: (...args: any[]) => any) {
  const original = target[methodName];
  Object.defineProperty(target, methodName, {
    value: impl,
    writable: true,
    configurable: true,
    enumerable: true,
  });
  t.after(() => {
    Object.defineProperty(target, methodName, {
      value: original,
      writable: true,
      configurable: true,
      enumerable: true,
    });
  });
}

function extractCookiePair(setCookieHeader: unknown, name: string): string | null {
  const values = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : setCookieHeader
      ? [String(setCookieHeader)]
      : [];
  for (const entry of values) {
    if (entry.startsWith(`${name}=`)) {
      return entry.split(';')[0];
    }
  }
  return null;
}

describe('AppSec: Dual-Token JWT, Refresh Rotation, RBAC & OWASP Hardening', () => {
  before(async () => {
    const appMod = await import('../src/app');
    app = appMod.default;
    prisma = appMod.prisma;
    prisma.auditLog.create = async ({ data }: any) => ({ id: 'audit-stub', ...data });
    memoryCache = (await import('../src/utils/cache')).memoryCache;
    const jwtMod = await import('../src/utils/jwt');
    generateAccessToken = jwtMod.generateAccessToken;
    generateRefreshToken = jwtMod.generateRefreshToken;
    sanitizePayload = (await import('../src/middlewares/sanitize.middleware')).sanitizePayload;
  });

  beforeEach(() => {
    memoryCache.clear();
  });

  it('issues short-lived access token + HttpOnly refresh cookie, rotates & blocks token reuse', async (t) => {
    const passwordHash = await bcrypt.hash('StrongPass!2026', 10);
    const sessions: any[] = [];

    mockMethod(t, prisma.user, 'findUnique', async ({ where }: any) => {
      if (where.email === 'admin@lakzee.fit' || where.id === 'u-admin-sec') {
        return {
          id: 'u-admin-sec',
          email: 'admin@lakzee.fit',
          password: passwordHash,
          role: 'ADMIN',
          firstName: 'Admin',
          lastName: 'User',
        };
      }
      return null;
    });

    mockMethod(t, prisma.refreshSession, 'create', async ({ data }: any) => {
      const rec = { ...data, revokedAt: null, replacedById: null };
      sessions.push(rec);
      return rec;
    });
    mockMethod(t, prisma.refreshSession, 'findUnique', async ({ where }: any) =>
      sessions.find((s) => s.tokenHash === where.tokenHash) ?? null
    );
    mockMethod(t, prisma.refreshSession, 'updateMany', async ({ where, data }: any) => {
      let count = 0;
      for (const s of sessions) {
        const matchesFamily = where.familyId ? s.familyId === where.familyId : true;
        const matchesHash = where.tokenHash ? s.tokenHash === where.tokenHash : true;
        if (matchesFamily && matchesHash && !s.revokedAt) {
          Object.assign(s, data);
          count++;
        }
      }
      return { count };
    });
    mockMethod(t, prisma, '$transaction', async (cb: any) =>
      cb({
        refreshSession: {
          update: async ({ where, data }: any) => {
            const target = sessions.find((s) => s.id === where.id);
            if (target) Object.assign(target, data);
            return target;
          },
          create: async ({ data }: any) => {
            const rec = { ...data, revokedAt: null, replacedById: null };
            sessions.push(rec);
            return rec;
          },
        },
      })
    );

    const loginRes = await dispatchSec('/api/auth/login', {
      method: 'POST',
      ip: '10.10.1.1',
      body: { email: 'admin@lakzee.fit', password: 'StrongPass!2026' },
    });

    assert.equal(loginRes.status, 200);
    assert.equal(loginRes.json.success, true);
    assert.ok(loginRes.json.data.accessToken);
    assert.equal(loginRes.json.data.refreshToken, undefined);
    assert.equal(loginRes.json.data.user.password, undefined);

    const setCookieRaw = String(loginRes.headers['set-cookie']);
    assert.ok(setCookieRaw.includes('HttpOnly'));
    assert.ok(setCookieRaw.includes('Path=/api/auth'));

    const cookie1 = extractCookiePair(loginRes.headers['set-cookie'], 'lakzee_refresh_token');
    assert.ok(cookie1);

    // A refresh token cannot be used directly as an API Bearer access token
    const refreshRawToken = cookie1.split('=')[1];
    const misuse = await dispatchSec('/api/members', {
      headers: { Authorization: `Bearer ${refreshRawToken}` },
    });
    assert.equal(misuse.status, 401);

    // Valid refresh rotates cookie and returns a new access token
    const refreshRes = await dispatchSec('/api/auth/refresh', {
      method: 'POST',
      headers: { Cookie: cookie1 },
    });
    assert.equal(refreshRes.status, 200);
    const cookie2 = extractCookiePair(refreshRes.headers['set-cookie'], 'lakzee_refresh_token');
    assert.ok(cookie2);
    assert.notEqual(cookie2, cookie1);

    // Replaying revoked cookie1 detects reuse & revokes the whole family (even cookie2!)
    const replay = await dispatchSec('/api/auth/refresh', {
      method: 'POST',
      headers: { Cookie: cookie1 },
    });
    assert.equal(replay.status, 401);

    const afterTheft = await dispatchSec('/api/auth/refresh', {
      method: 'POST',
      headers: { Cookie: cookie2 },
    });
    assert.equal(afterTheft.status, 401);
  });

  it('revokes refresh session and clears cookie on POST /api/auth/logout', async (t) => {
    const token = generateRefreshToken({ id: 'u-1', role: 'ADMIN' }, 'jti-1', 'fam-1');
    let revokedCount = 0;

    mockMethod(t, prisma.refreshSession, 'updateMany', async () => {
      revokedCount += 1;
      return { count: 1 };
    });

    const res = await dispatchSec('/api/auth/logout', {
      method: 'POST',
      headers: { Cookie: `lakzee_refresh_token=${token}` },
    });
    assert.equal(res.status, 200);
    assert.equal(revokedCount, 1);
    assert.ok(String(res.headers['set-cookie']).includes('Expires=Thu, 01 Jan 1970'));
  });

  it('enforces RBAC: blocks 401 unauthenticated, 403 lower roles, and protects SUPER_ADMIN from ADMIN', async (t) => {
    mockMethod(t, prisma.user, 'findUnique', async ({ where }: any) => {
      if (where.id === 'u-member') return { id: 'u-member', role: 'MEMBER' };
      if (where.id === 'u-trainer') return { id: 'u-trainer', role: 'TRAINER' };
      if (where.id === 'u-admin') return { id: 'u-admin', role: 'ADMIN' };
      if (where.id === 'u-super') return { id: 'u-super', role: 'SUPER_ADMIN' };
      return null;
    });
    mockMethod(t, prisma.user, 'findMany', async () => []);

    const memberTok = generateAccessToken({ id: 'u-member', role: 'MEMBER' });
    const trainerTok = generateAccessToken({ id: 'u-trainer', role: 'TRAINER' });
    const adminTok = generateAccessToken({ id: 'u-admin', role: 'ADMIN' });
    const superTok = generateAccessToken({ id: 'u-super', role: 'SUPER_ADMIN' });

    assert.equal((await dispatchSec('/api/dashboard/stats')).status, 401);
    assert.equal(
      (await dispatchSec('/api/dashboard/stats', { headers: { Authorization: `Bearer ${memberTok}` } })).status,
      403
    );
    assert.equal(
      (
        await dispatchSec('/api/members/target-1', {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${trainerTok}` },
        })
      ).status,
      403
    );
    assert.equal(
      (await dispatchSec('/api/reports', { headers: { Authorization: `Bearer ${trainerTok}` } })).status,
      403
    );

    // ADMIN cannot promote anyone to SUPER_ADMIN or revoke SUPER_ADMIN
    const escalate = await dispatchSec('/api/staff/assign', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminTok}` },
      body: { userId: 'u-trainer', role: 'SUPER_ADMIN' },
    });
    assert.equal(escalate.status, 403);

    const revokeSuper = await dispatchSec('/api/staff/u-super/revoke', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminTok}` },
    });
    assert.equal(revokeSuper.status, 403);

    // SUPER_ADMIN inherits all ADMIN permissions cleanly
    const staffOk = await dispatchSec('/api/staff', {
      headers: { Authorization: `Bearer ${superTok}` },
    });
    assert.equal(staffOk.status, 200);
  });

  it('rate-limits brute-force login attempts with 429 and rejects >100kb JSON payloads with 413', async (t) => {
    mockMethod(t, prisma.user, 'findUnique', async () => null);

    // Exhaust 10 attempts allowed per 15 min from an isolated IP
    for (let i = 0; i < 10; i++) {
      const attempt = await dispatchSec('/api/auth/login', {
        method: 'POST',
        ip: '10.99.99.5',
        body: { email: 'victim@lakzee.fit', password: 'wrong' },
      });
      assert.equal(attempt.status, 401);
    }

    const blocked = await dispatchSec('/api/auth/login', {
      method: 'POST',
      ip: '10.99.99.5',
      body: { email: 'victim@lakzee.fit', password: 'wrong' },
    });
    assert.equal(blocked.status, 429);
    assert.equal(blocked.json.success, false);

    // Oversized JSON (>100kb) rejected with 413 Payload Too Large
    const giantPayload = JSON.stringify({ data: 'x'.repeat(130 * 1024) });
    const tooLarge = await dispatchSec('/api/plans', {
      method: 'POST',
      rawBody: giantPayload,
    });
    assert.equal(tooLarge.status, 413);
    assert.equal(tooLarge.json.code, 'PAYLOAD_TOO_LARGE');
  });

  it('emits strict OWASP headers, sanitizes injection/XSS inputs, and blocks disallowed CORS origins', async () => {
    const health = await dispatchSec('/health');
    assert.equal(health.headers['x-frame-options'], 'DENY');
    assert.equal(health.headers['x-content-type-options'], 'nosniff');
    assert.equal(health.headers['x-powered-by'], undefined);
    assert.ok(String(health.headers['content-security-policy']).includes("default-src 'none'"));

    const sanitized = sanitizePayload({
      name: '<script>alert(1)</script>Vikram',
      $gt: '',
      nested: { $ne: null, title: 'javascript:evil()' },
      password: 'Keep<$>Password!0',
    });
    assert.equal(sanitized.name, 'Vikram');
    assert.equal('$gt' in sanitized, false);
    assert.equal('$ne' in sanitized.nested, false);
    assert.equal(sanitized.nested.title, 'evil()');
    assert.equal(sanitized.password, 'Keep<$>Password!0');

    const { isAllowedOrigin } = await import('../src/config/env');
    assert.equal(isAllowedOrigin('https://evil-attacker.example.com'), false);
    assert.equal(isAllowedOrigin('http://localhost:3000'), true);
    assert.equal(Object.prototype.hasOwnProperty.call(sanitizePayload(JSON.parse('{"__proto__":{"polluted":true}}')), '__proto__'), false);
  });
});
