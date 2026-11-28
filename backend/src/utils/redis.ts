import net from 'net';
import tls from 'tls';
import { logger } from './logger';

export type RedisBackendMode = 'upstash-rest' | 'tcp-resp' | 'memory-fallback';

export interface DistributedRedisClient {
  readonly mode: RedisBackendMode;
  isEnabled(): boolean;
  ping(): Promise<boolean>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  del(...keys: string[]): Promise<void>;
  deletePrefix(prefix: string): Promise<void>;
  incrWithTtl(key: string, windowMs: number): Promise<{ count: number; ttlMs: number } | null>;
  decr(key: string): Promise<void>;
  getStatus(): {
    mode: RedisBackendMode;
    configured: boolean;
    healthy: boolean;
    circuitOpenUntil: number | null;
  };
}

const CIRCUIT_OPEN_DURATION_MS = 15_000;
const COMMAND_TIMEOUT_MS = 2_000;

function encodeRespArray(args: Array<string | number>): string {
  const parts = [`*${args.length}\r\n`];
  for (const arg of args) {
    const str = String(arg);
    parts.push(`$${Buffer.byteLength(str, 'utf8')}\r\n${str}\r\n`);
  }
  return parts.join('');
}

function parseRespValue(buffer: Buffer, offset = 0): { value: unknown; nextOffset: number } | null {
  if (offset >= buffer.length) return null;
  const prefix = String.fromCharCode(buffer[offset]);
  const lineEnd = buffer.indexOf('\r\n', offset);
  if (lineEnd === -1) return null;
  const header = buffer.subarray(offset + 1, lineEnd).toString('utf8');

  if (prefix === '+' || prefix === ':') {
    return {
      value: prefix === ':' ? Number(header) : header,
      nextOffset: lineEnd + 2,
    };
  }

  if (prefix === '-') {
    throw new Error(`Redis error: ${header}`);
  }

  if (prefix === '$') {
    const len = parseInt(header, 10);
    if (len === -1) {
      return { value: null, nextOffset: lineEnd + 2 };
    }
    const end = lineEnd + 2 + len;
    if (end + 2 > buffer.length) return null;
    return {
      value: buffer.subarray(lineEnd + 2, end).toString('utf8'),
      nextOffset: end + 2,
    };
  }

  if (prefix === '*') {
    const count = parseInt(header, 10);
    if (count === -1) {
      return { value: null, nextOffset: lineEnd + 2 };
    }
    let cursor = lineEnd + 2;
    const arr: unknown[] = [];
    for (let i = 0; i < count; i++) {
      const parsed = parseRespValue(buffer, cursor);
      if (!parsed) return null;
      arr.push(parsed.value);
      cursor = parsed.nextOffset;
    }
    return { value: arr, nextOffset: cursor };
  }

  throw new Error(`Unsupported RESP prefix: ${prefix}`);
}

async function execTcpRespCommands(redisUrl: string, commands: Array<Array<string | number>>): Promise<unknown[]> {
  const parsed = new URL(redisUrl);
  const useTls = parsed.protocol === 'rediss:';
  const host = parsed.hostname || '127.0.0.1';
  const port = Number(parsed.port || (useTls ? 6380 : 6379));
  const password = parsed.password ? decodeURIComponent(parsed.password) : undefined;
  const username = parsed.username ? decodeURIComponent(parsed.username) : undefined;
  const dbSegment = parsed.pathname?.replace('/', '').trim();
  const dbIndex = dbSegment && /^\d+$/.test(dbSegment) ? Number(dbSegment) : null;

  const fullPipeline: Array<Array<string | number>> = [];
  if (password) {
    fullPipeline.push(username ? ['AUTH', username, password] : ['AUTH', password]);
  }
  if (dbIndex !== null && dbIndex > 0) {
    fullPipeline.push(['SELECT', dbIndex]);
  }
  const preambleCount = fullPipeline.length;
  fullPipeline.push(...commands);

  return new Promise((resolve, reject) => {
    let settled = false;
    let recvBuffer: Buffer = Buffer.alloc(0);
    const socket = useTls
      ? tls.connect({ host, port, servername: host })
      : net.createConnection({ host, port });

    const finish = (err?: Error, values?: unknown[]) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      if (err) reject(err);
      else resolve(values ?? []);
    };

    const timer = setTimeout(() => {
      finish(new Error('Redis TCP command timed out'));
    }, COMMAND_TIMEOUT_MS);

    socket.once('error', (err) => finish(err));

    const connectEvent = useTls ? 'secureConnect' : 'connect';
    socket.once(connectEvent, () => {
      const payload = fullPipeline.map(encodeRespArray).join('');
      socket.write(payload);
    });

    socket.on('data', (chunk: Buffer) => {
      recvBuffer = Buffer.concat([recvBuffer, chunk]);
      try {
        const results: unknown[] = [];
        let cursor = 0;
        for (let i = 0; i < fullPipeline.length; i++) {
          const parsedResp = parseRespValue(recvBuffer, cursor);
          if (!parsedResp) return;
          results.push(parsedResp.value);
          cursor = parsedResp.nextOffset;
        }
        finish(undefined, results.slice(preambleCount));
      } catch (err) {
        finish(err instanceof Error ? err : new Error(String(err)));
      }
    });
  });
}

async function execUpstashRestPipeline(
  baseUrl: string,
  token: string,
  commands: Array<Array<string | number>>
): Promise<unknown[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), COMMAND_TIMEOUT_MS);
  try {
    const endpoint = `${baseUrl.replace(/\/+$/, '')}/pipeline`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(commands),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Upstash Redis HTTP ${response.status}`);
    }

    const payload = (await response.json()) as Array<{ result?: unknown; error?: string }>;
    return payload.map((item) => {
      if (item.error) throw new Error(item.error);
      return item.result ?? null;
    });
  } finally {
    clearTimeout(timer);
  }
}

export interface RedisAdapterEnv {
  upstashUrl?: string;
  upstashToken?: string;
  redisUrl?: string;
  fetchImpl?: typeof fetch;
}

export class HybridRedisAdapter implements DistributedRedisClient {
  readonly mode: RedisBackendMode;
  private readonly upstashUrl?: string;
  private readonly upstashToken?: string;
  private readonly redisUrl?: string;
  private circuitOpenUntil: number | null = null;
  private healthy = false;

  constructor(env: RedisAdapterEnv = {}) {
    this.upstashUrl = env.upstashUrl?.trim() || process.env.UPSTASH_REDIS_REST_URL?.trim();
    this.upstashToken = env.upstashToken?.trim() || process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
    this.redisUrl = env.redisUrl?.trim() || process.env.REDIS_URL?.trim();

    if (this.upstashUrl && this.upstashToken) {
      this.mode = 'upstash-rest';
      this.healthy = true;
    } else if (this.redisUrl && (this.redisUrl.startsWith('redis://') || this.redisUrl.startsWith('rediss://'))) {
      this.mode = 'tcp-resp';
      this.healthy = true;
    } else {
      this.mode = 'memory-fallback';
      this.healthy = true;
    }
  }

  isEnabled(): boolean {
    return this.mode !== 'memory-fallback';
  }

  private canAttemptRemote(): boolean {
    if (!this.isEnabled()) return false;
    if (this.circuitOpenUntil && Date.now() < this.circuitOpenUntil) {
      return false;
    }
    return true;
  }

  private async runPipeline(commands: Array<Array<string | number>>): Promise<unknown[] | null> {
    if (!this.canAttemptRemote() || commands.length === 0) return null;

    try {
      const results =
        this.mode === 'upstash-rest'
          ? await execUpstashRestPipeline(this.upstashUrl!, this.upstashToken!, commands)
          : await execTcpRespCommands(this.redisUrl!, commands);
      this.healthy = true;
      this.circuitOpenUntil = null;
      return results;
    } catch (err) {
      this.healthy = false;
      this.circuitOpenUntil = Date.now() + CIRCUIT_OPEN_DURATION_MS;
      logger.warn('Redis unavailable; gracefully falling back to in-memory store', {
        mode: this.mode,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  async ping(): Promise<boolean> {
    if (!this.isEnabled()) return false;
    const res = await this.runPipeline([['PING']]);
    return Boolean(res && res[0] === 'PONG');
  }

  async get(key: string): Promise<string | null> {
    const res = await this.runPipeline([['GET', key]]);
    if (!res) return null;
    return typeof res[0] === 'string' ? res[0] : null;
  }

  async set(key: string, value: string, ttlSeconds = 60): Promise<void> {
    if (ttlSeconds <= 0) return;
    await this.runPipeline([['SET', key, value, 'EX', Math.max(1, Math.ceil(ttlSeconds))]]);
  }

  async del(...keys: string[]): Promise<void> {
    const clean = keys.filter(Boolean);
    if (clean.length === 0) return;
    await this.runPipeline([['DEL', ...clean]]);
  }

  async deletePrefix(prefix: string): Promise<void> {
    if (!this.canAttemptRemote()) return;
    let cursor = '0';
    let safety = 0;

    do {
      const scanRes = await this.runPipeline([['SCAN', cursor, 'MATCH', `${prefix}*`, 'COUNT', 100]]);
      if (!scanRes || !Array.isArray(scanRes[0])) return;
      const [nextCursor, matchedKeys] = scanRes[0] as [string, string[]];
      if (Array.isArray(matchedKeys) && matchedKeys.length > 0) {
        await this.del(...matchedKeys);
      }
      cursor = String(nextCursor ?? '0');
      safety += 1;
    } while (cursor !== '0' && safety < 25);
  }

  async incrWithTtl(key: string, windowMs: number): Promise<{ count: number; ttlMs: number } | null> {
    const first = await this.runPipeline([
      ['INCR', key],
      ['PTTL', key],
    ]);
    if (!first) return null;

    const count = Number(first[0] ?? 1);
    let ttlMs = Number(first[1] ?? -1);
    if (count === 1 || ttlMs < 0) {
      await this.runPipeline([['PEXPIRE', key, Math.max(1000, Math.ceil(windowMs))]]);
      ttlMs = windowMs;
    }
    return { count, ttlMs };
  }

  async decr(key: string): Promise<void> {
    await this.runPipeline([['DECR', key]]);
  }

  getStatus() {
    return {
      mode: this.mode,
      configured: this.isEnabled(),
      healthy: this.healthy,
      circuitOpenUntil: this.circuitOpenUntil,
    };
  }
}

export const redisAdapter = new HybridRedisAdapter();
