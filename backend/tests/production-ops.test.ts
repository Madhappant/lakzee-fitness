/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, before, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { Duplex } from 'node:stream';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://isolated_test:isolated_test@127.0.0.1:5432/lakzee_isolated_test?schema=public';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'unit-test-secret-lakzee';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'unit-test-secret-lakzee-refresh';

let app: any;
let setServerDraining: any;
let redactSensitiveData: any;

class OpsSocket extends Duplex {
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

async function getHealth(url: string) {
  const socket = new OpsSocket();
  const req = new http.IncomingMessage(socket as any);
  req.method = 'GET';
  req.url = url;
  req.headers = { host: '127.0.0.1', 'accept-encoding': 'identity' };
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
  return { status: res.statusCode, json: body ? JSON.parse(body) : null };
}

describe('Production Ops: Structured Log Redaction & Graceful Shutdown Drain', () => {
  before(async () => {
    app = (await import('../src/app')).default;
    setServerDraining = (await import('../src/config/lifecycle')).setServerDraining;
    redactSensitiveData = (await import('../src/utils/logger')).redactSensitiveData;
  });

  afterEach(() => {
    setServerDraining(false);
  });

  it('redacts passwords, tokens, secrets, cookies, OTPs & Bearer headers from logs', () => {
    const redacted = redactSensitiveData({
      email: 'admin@lakzee.fit',
      password: 'SecretPassword123',
      accessToken: 'eyJ.token.val',
      authorization: 'Bearer abc.def.ghi',
      cookie: 'lakzee_refresh_token=xyz',
      resetOtp: '481920',
      nested: {
        jwtSecret: 'top-secret',
        status: 'ok',
      },
    }) as Record<string, any>;

    assert.equal(redacted.email, 'admin@lakzee.fit');
    assert.equal(redacted.password, '[REDACTED]');
    assert.equal(redacted.accessToken, '[REDACTED]');
    assert.equal(redacted.authorization, '[REDACTED]');
    assert.equal(redacted.cookie, '[REDACTED]');
    assert.equal(redacted.resetOtp, '[REDACTED]');
    assert.equal(redacted.nested.jwtSecret, '[REDACTED]');
    assert.equal(redacted.nested.status, 'ok');
  });

  it('switches /health and /api/health to 503 draining during SIGTERM graceful shutdown', async () => {
    setServerDraining(true);

    const apiHealth = await getHealth('/api/health');
    assert.equal(apiHealth.status, 503);
    assert.equal(apiHealth.json.status, 'draining');

    const rootHealth = await getHealth('/health');
    assert.equal(rootHealth.status, 503);
    assert.equal(rootHealth.json.status, 'draining');

    setServerDraining(false);
    const recovered = await getHealth('/health');
    assert.equal(recovered.status, 200);
    assert.equal(recovered.json.status, 'success');
  });
});
