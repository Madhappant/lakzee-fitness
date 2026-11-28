/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { Duplex } from 'node:stream';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://isolated_test:isolated_test@127.0.0.1:5432/lakzee_isolated_test?schema=public';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'unit-test-secret-lakzee';

let app: any;
let prisma: any;
let memoryCache: any;
let generateToken: any;
let MemberService: any;

class PipelineTestSocket extends Duplex {
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

async function sendRequest(
  url: string,
  options: { method?: string; headers?: Record<string, string>; body?: unknown } = {}
) {
  const socket = new PipelineTestSocket();
  const req = new http.IncomingMessage(socket as any);
  req.method = options.method ?? 'GET';
  req.url = url;
  req.headers = { host: '127.0.0.1', 'accept-encoding': 'identity' };
  for (const [k, v] of Object.entries(options.headers ?? {})) {
    req.headers[k.toLowerCase()] = v;
  }
  if (options.body !== undefined) {
    const buf = Buffer.from(JSON.stringify(options.body), 'utf8');
    req.headers['content-type'] = 'application/json';
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
  return {
    status: res.statusCode,
    json: body ? JSON.parse(body) : null,
  };
}

function mockPrismaMethod(t: any, target: any, methodName: string, impl: (...args: any[]) => any) {
  const original = target[methodName];
  let calls = 0;
  Object.defineProperty(target, methodName, {
    value: (...args: any[]) => {
      calls += 1;
      return impl(...args);
    },
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
  return { get calls() { return calls; } };
}

describe('End-to-end layered backend pipeline (Router -> Middleware -> Controller -> Service -> Repo)', () => {
  before(async () => {
    const appMod = await import('../src/app');
    app = appMod.default;
    prisma = appMod.prisma;
    memoryCache = (await import('../src/utils/cache')).memoryCache;
    generateToken = (await import('../src/utils/jwt')).generateToken;
    MemberService = (await import('../src/services/member.service')).MemberService;
  });

  beforeEach(() => {
    memoryCache.clear();
  });

  it('rejects invalid input in validation middleware before hitting repository or DB', async (t) => {
    const token = generateToken({ id: 'admin-1', role: 'ADMIN' });
    mockPrismaMethod(t, prisma.user, 'findUnique', async () => ({ id: 'admin-1', role: 'ADMIN' }));
    const createSpy = mockPrismaMethod(t, prisma.membershipPlan, 'create', async () => ({}));

    const invalidPlan = await sendRequest('/api/plans', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: { name: '', price: -50, durationDays: 0 },
    });

    assert.equal(invalidPlan.status, 400);
    assert.equal(invalidPlan.json.success, false);
    assert.equal(invalidPlan.json.status, 'error');
    assert.equal(invalidPlan.json.message, 'Validation failed');
    assert.equal(createSpy.calls, 0);

    const invalidContact = await sendRequest('/api/contact', {
      method: 'POST',
      body: { name: 'A', phone: '12', goal: '' },
    });
    assert.equal(invalidContact.status, 400);
    assert.equal(invalidContact.json.success, false);
  });

  it('returns standardized { success, status, data, meta } envelope through full CRUD pipeline', async (t) => {
    const token = generateToken({ id: 'admin-1', role: 'ADMIN' });
    mockPrismaMethod(t, prisma.user, 'findUnique', async () => ({ id: 'admin-1', role: 'ADMIN' }));
    mockPrismaMethod(t, prisma.membershipPlan, 'create', async ({ data }: any) => ({
      id: 'plan-new',
      ...data,
    }));

    const created = await sendRequest('/api/plans', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: { name: 'Quarterly Gold', price: '3999', durationDays: '90', gstPercentage: '18' },
    });

    assert.equal(created.status, 201);
    assert.equal(created.json.success, true);
    assert.equal(created.json.status, 'success');
    assert.equal(created.json.data.name, 'Quarterly Gold');
    assert.equal(created.json.data.price, 3999);
    assert.equal(created.json.data.durationDays, 90);
  });

  it('MemberService operates cleanly over an injected repository seam across list, update & delete', async () => {
    const store = [
      { id: 'u10', email: 'ten@gym.in', createdAt: new Date('2026-01-01'), memberProfile: { id: 'p10', memberId: '010' } },
      { id: 'u2', email: 'two@gym.in', createdAt: new Date('2026-01-02'), memberProfile: { id: 'p2', memberId: '002' } },
    ];
    let deletedProfileId: string | undefined;

    const fakeRepo: any = {
      findAllMemberIds: async () => store.map((s) => ({ memberId: s.memberProfile.memberId })),
      findProfileByMemberId: async () => null,
      listMembers: async () => store,
      findMemberSummaryById: async (id: string) => store.find((s) => s.id === id) ?? null,
      findUserByEmail: async () => null,
      updateMemberUser: async (id: string, data: any) => ({ id, ...data }),
      deleteMemberCascade: async (_id: string, profileId?: string) => {
        deletedProfileId = profileId;
      },
    };

    const service = new MemberService(fakeRepo);
    const { members, sortOrder } = await service.listMembers('asc');
    assert.equal(sortOrder, 'asc');
    assert.deepEqual(
      members.map((m: any) => m.memberProfile.memberId),
      ['002', '010']
    );

    const nextSeqId = await service.generateSequentialMemberId();
    assert.equal(nextSeqId, '011');

    await service.deleteMember('u10');
    assert.equal(deletedProfileId, 'p10');
  });
});
