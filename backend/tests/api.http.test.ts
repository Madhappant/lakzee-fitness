/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { Duplex } from 'node:stream';
import express from 'express';

// Ensure JWT module initializes safely even when run outside a local .env environment
process.env.JWT_SECRET = process.env.JWT_SECRET || 'unit-test-secret-lakzee';

let app: any;
let prisma: any;
let memoryCache: any;
let generateToken: any;
let errorHandler: any;
let BadRequestError: any;

class InMemorySocket extends Duplex {
  readonly chunks: Buffer[] = [];
  remoteAddress = '127.0.0.1';

  _read() {}

  _write(chunk: any, _encoding: BufferEncoding, callback: (error?: Error | null) => void) {
    this.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    callback();
  }

  setTimeout() {
    return this;
  }

  setNoDelay() {
    return this;
  }

  destroy() {
    return this;
  }
}

function decodeHttpBody(rawResponse: Buffer, isChunked: boolean): string {
  const headerEnd = rawResponse.indexOf('\r\n\r\n');
  const payload = headerEnd >= 0 ? rawResponse.subarray(headerEnd + 4) : rawResponse;
  if (!isChunked) {
    return payload.toString('utf8');
  }

  let offset = 0;
  const parts: Buffer[] = [];
  while (offset < payload.length) {
    const lineEnd = payload.indexOf('\r\n', offset);
    if (lineEnd === -1) break;
    const sizeHex = payload.subarray(offset, lineEnd).toString('ascii').split(';')[0].trim();
    const size = parseInt(sizeHex, 16);
    if (Number.isNaN(size) || size === 0) break;
    const start = lineEnd + 2;
    parts.push(payload.subarray(start, start + size));
    offset = start + size + 2;
  }
  return Buffer.concat(parts).toString('utf8');
}

async function dispatchRequest(
  targetApp: any,
  url: string,
  options: { method?: string; headers?: Record<string, string>; body?: unknown } = {}
) {
  const socket = new InMemorySocket();
  const req = new http.IncomingMessage(socket as any);
  req.method = options.method ?? 'GET';
  req.url = url;
  req.headers = {
    host: '127.0.0.1',
    'accept-encoding': 'identity',
  };

  for (const [key, value] of Object.entries(options.headers ?? {})) {
    req.headers[key.toLowerCase()] = value;
  }

  if (options.body !== undefined) {
    const encoded = Buffer.from(
      typeof options.body === 'string' ? options.body : JSON.stringify(options.body),
      'utf8'
    );
    req.headers['content-type'] = req.headers['content-type'] || 'application/json';
    req.headers['content-length'] = String(encoded.length);
    req.push(encoded);
  }
  req.push(null);

  const res = new http.ServerResponse(req);
  res.assignSocket(socket as any);

  await new Promise<void>((resolve, reject) => {
    const onError = (err: Error) => reject(err);
    res.once('error', onError);
    res.once('finish', () => {
      res.off('error', onError);
      resolve();
    });
    targetApp(req, res);
  });

  const rawHeaders = res.getHeaders();
  const transferEncoding = String(rawHeaders['transfer-encoding'] ?? '').toLowerCase();
  const bodyText = decodeHttpBody(Buffer.concat(socket.chunks), transferEncoding.includes('chunked'));
  let json: any = null;
  try {
    json = bodyText ? JSON.parse(bodyText) : null;
  } catch {
    json = bodyText;
  }

  return {
    status: res.statusCode,
    headers: rawHeaders,
    json,
  };
}

/**
 * Replaces a method on a Prisma proxy or delegate and restores it via t.after().
 */
function stubMethod(t: any, target: any, methodName: string, impl: (...args: any[]) => any) {
  const original = target[methodName];
  let calls = 0;
  let activeImpl = impl;

  const wrapper = (...args: any[]) => {
    calls += 1;
    return activeImpl(...args);
  };

  Object.defineProperty(target, methodName, {
    value: wrapper,
    writable: true,
    configurable: true,
    enumerable: true,
  });

  t.after(() => {
    if (original === undefined) {
      delete target[methodName];
    } else {
      Object.defineProperty(target, methodName, {
        value: original,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    }
  });

  return {
    get callCount() {
      return calls;
    },
    setNext(nextImpl: (...args: any[]) => any) {
      activeImpl = nextImpl;
    },
  };
}

describe('HTTP API routes, caching, auth & error middleware', () => {
  before(async () => {
    const appMod = await import('../src/app');
    app = appMod.default;
    prisma = appMod.prisma;

    const cacheMod = await import('../src/utils/cache');
    memoryCache = cacheMod.memoryCache;

    const jwtMod = await import('../src/utils/jwt');
    generateToken = jwtMod.generateToken;

    const errMiddlewareMod = await import('../src/middlewares/error.middleware');
    errorHandler = errMiddlewareMod.errorHandler;

    const errorsMod = await import('../src/utils/errors');
    BadRequestError = errorsMod.BadRequestError;
  });

  beforeEach(() => {
    memoryCache.clear();
  });

  it('GET /health returns fast 200 status and ?deep=1 probes database readiness', async (t) => {
    const fast = await dispatchRequest(app, '/health');
    assert.equal(fast.status, 200);
    assert.equal(fast.json.status, 'success');
    assert.equal(typeof fast.json.uptimeSeconds, 'number');

    const queryStub = stubMethod(t, prisma, '$queryRaw', async () => [{ '?column?': 1 }]);
    const deepUp = await dispatchRequest(app, '/health?deep=1');
    assert.equal(deepUp.status, 200);
    assert.equal(deepUp.json.db, 'up');
    assert.equal(queryStub.callCount, 1);

    queryStub.setNext(async () => {
      throw new Error('connection refused');
    });
    const deepDown = await dispatchRequest(app, '/health?deep=1');
    assert.equal(deepDown.status, 503);
    assert.equal(deepDown.json.db, 'down');
  });

  it('GET /api/plans caches in memory, sets revalidation headers & exposes rate-limit headers', async (t) => {
    const samplePlans = [
      { id: 'plan-1', name: 'Monthly Pro', price: 1500, durationDays: 30, isActive: true },
    ];
    const findManyStub = stubMethod(
      t,
      prisma.membershipPlan,
      'findMany',
      async () => samplePlans
    );

    const first = await dispatchRequest(app, '/api/plans');
    assert.equal(first.status, 200);
    assert.equal(first.headers['cache-control'], 'public, max-age=0, must-revalidate');
    assert.equal(String(first.headers['ratelimit-limit']), '300');
    assert.equal(first.json.data.length, 1);

    // Second request must hit memoryCache rather than hitting Prisma again
    const second = await dispatchRequest(app, '/api/plans');
    assert.equal(second.status, 200);
    assert.equal(second.json.data[0].name, 'Monthly Pro');
    assert.equal(findManyStub.callCount, 1);
  });

  it('rejects protected endpoints with 401 when Bearer token is missing or invalid', async () => {
    const noToken = await dispatchRequest(app, '/api/members');
    assert.equal(noToken.status, 401);
    assert.equal(noToken.json.status, 'error');

    const badToken = await dispatchRequest(app, '/api/members', {
      headers: { Authorization: 'Bearer not-a-real-jwt' },
    });
    assert.equal(badToken.status, 401);
  });

  it('GET /api/notifications micro-caches auth lookup and emits userId link for expiry notifications', async (t) => {
    const token = generateToken({ id: 'admin-user-1', role: 'ADMIN' });
    const futureSoon = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const userFindStub = stubMethod(t, prisma.user, 'findUnique', async () => ({
      id: 'admin-user-1',
      role: 'ADMIN',
    }));
    stubMethod(t, prisma.invoice, 'findMany', async () => []);
    stubMethod(t, prisma.subscription, 'findMany', async (args: any) => {
      if (args?.where?.paymentStatus === 'PENDING') return [];
      return [
        {
          id: 'sub-exp-1',
          endDate: futureSoon,
          plan: { name: 'Gold Plan' },
          member: {
            id: 'profile-id-should-not-appear',
            userId: 'member-user-999',
            user: { firstName: 'Riya', lastName: 'Menon' },
          },
        },
      ];
    });
    stubMethod(t, prisma.memberProfile, 'findMany', async () => []);
    stubMethod(t, prisma.announcement, 'findMany', async () => []);

    const first = await dispatchRequest(app, '/api/notifications?tzOffset=0', {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(first.status, 200);
    const expiryNotif = first.json.data.find((n: any) => n.type === 'EXPIRY');
    assert.ok(expiryNotif);
    assert.equal(expiryNotif.link, '/admin/members/member-user-999/plan');

    // Second request within 5s must reuse AUTH_USER cache instead of querying prisma.user again
    const second = await dispatchRequest(app, '/api/notifications?tzOffset=0', {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(second.status, 200);
    assert.equal(userFindStub.callCount, 1);
  });

  it('centralized errorHandler masks unexpected 500 errors in production while preserving AppError responses', async () => {
    const miniApp = express();
    miniApp.get('/boom', () => {
      throw new Error('sensitive sql driver crash details');
    });
    miniApp.get('/bad', () => {
      throw new BadRequestError('Missing plan ID');
    });
    miniApp.use(errorHandler);

    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
      const boomRes = await dispatchRequest(miniApp, '/boom');
      assert.equal(boomRes.status, 500);
      assert.equal(boomRes.json.message, 'Internal server error');
      assert.equal(boomRes.json.stack, undefined);

      const badRes = await dispatchRequest(miniApp, '/bad');
      assert.equal(badRes.status, 400);
      assert.equal(badRes.json.message, 'Missing plan ID');
    } finally {
      process.env.NODE_ENV = prevEnv;
    }
  });
});
