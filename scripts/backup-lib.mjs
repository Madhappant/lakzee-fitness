import crypto from 'crypto';
import zlib from 'zlib';

export const ENCRYPTION_MAGIC = Buffer.from('LAKZEE-ENC-V1\n', 'utf8');
export const DEFAULT_GFS_POLICY = Object.freeze({
  daily: 7,
  weekly: 4,
  monthly: 12,
});

export function computeSha256Hex(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export function gzipCompress(buffer) {
  return zlib.gzipSync(buffer, { level: 9 });
}

export function gzipDecompress(buffer) {
  return zlib.gunzipSync(buffer);
}

/**
 * Encrypts a Buffer using authenticated AES-256-GCM with scrypt key derivation.
 * Output format: [14B magic][16B salt][12B iv][16B authTag][ciphertext]
 */
export function encryptBufferAes256Gcm(plaintextBuf, passphrase) {
  if (!passphrase || typeof passphrase !== 'string' || passphrase.trim().length < 16) {
    throw new Error('BACKUP_ENCRYPTION_KEY must be at least 16 characters.');
  }
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.scryptSync(passphrase.trim(), salt, 32, { N: 16384, r: 8, p: 1 });
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintextBuf), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([ENCRYPTION_MAGIC, salt, iv, authTag, encrypted]);
}

export function decryptBufferAes256Gcm(encryptedBuf, passphrase) {
  if (!passphrase || typeof passphrase !== 'string' || passphrase.trim().length < 16) {
    throw new Error('BACKUP_ENCRYPTION_KEY must be at least 16 characters.');
  }
  const headerLen = ENCRYPTION_MAGIC.length;
  const minLen = headerLen + 16 + 12 + 16;
  if (!Buffer.isBuffer(encryptedBuf) || encryptedBuf.length < minLen) {
    throw new Error('Encrypted backup file is malformed or truncated.');
  }
  const magic = encryptedBuf.subarray(0, headerLen);
  if (!magic.equals(ENCRYPTION_MAGIC)) {
    throw new Error('Unsupported encrypted backup format header.');
  }

  let cursor = headerLen;
  const salt = encryptedBuf.subarray(cursor, cursor + 16);
  cursor += 16;
  const iv = encryptedBuf.subarray(cursor, cursor + 12);
  cursor += 12;
  const authTag = encryptedBuf.subarray(cursor, cursor + 16);
  cursor += 16;
  const ciphertext = encryptedBuf.subarray(cursor);

  const key = crypto.scryptSync(passphrase.trim(), salt, 32, { N: 16384, r: 8, p: 1 });
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

export function parseBackupTimestamp(nameOrKey) {
  const base = String(nameOrKey || '').split('/').pop() || '';
  const match = base.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})Z/);
  if (!match) return null;
  const iso = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}Z`;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatUtcDayKey(date) {
  return date.toISOString().slice(0, 10);
}

function formatUtcMonthKey(date) {
  return date.toISOString().slice(0, 7);
}

function formatUtcIsoWeekKey(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

/**
 * Grandfather-Father-Son (GFS) retention selector:
 * Keeps 7 newest daily snapshots, 4 distinct weekly snapshots, and 12 distinct monthly snapshots.
 */
export function selectGfsRetentionKeys(snapshots, policy = DEFAULT_GFS_POLICY) {
  const dailyMax = policy.daily ?? DEFAULT_GFS_POLICY.daily;
  const weeklyMax = policy.weekly ?? DEFAULT_GFS_POLICY.weekly;
  const monthlyMax = policy.monthly ?? DEFAULT_GFS_POLICY.monthly;

  const normalized = snapshots
    .map((item) => {
      const key = typeof item === 'string' ? item : item.key;
      const explicitDate = typeof item === 'object' && item.createdAt ? new Date(item.createdAt) : null;
      const timestamp = explicitDate && !Number.isNaN(explicitDate.getTime())
        ? explicitDate
        : parseBackupTimestamp(key);
      return timestamp ? { key, timestamp } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  const keepSet = new Set();
  const tiers = { daily: [], weekly: [], monthly: [] };
  const dailyDays = new Set();
  const coveredWeeks = new Set();
  const weeklyPicked = new Set();
  const coveredMonths = new Set();
  const monthlyPicked = new Set();

  for (const snap of normalized) {
    const dayKey = formatUtcDayKey(snap.timestamp);
    if (!dailyDays.has(dayKey) && dailyDays.size < dailyMax) {
      dailyDays.add(dayKey);
      coveredWeeks.add(formatUtcIsoWeekKey(snap.timestamp));
      coveredMonths.add(formatUtcMonthKey(snap.timestamp));
      keepSet.add(snap.key);
      tiers.daily.push(snap.key);
    }
  }

  for (const snap of normalized) {
    const weekKey = formatUtcIsoWeekKey(snap.timestamp);
    if (!keepSet.has(snap.key) && !coveredWeeks.has(weekKey) && weeklyPicked.size < weeklyMax) {
      coveredWeeks.add(weekKey);
      weeklyPicked.add(weekKey);
      coveredMonths.add(formatUtcMonthKey(snap.timestamp));
      keepSet.add(snap.key);
      tiers.weekly.push(snap.key);
    }
  }

  for (const snap of normalized) {
    const monthKey = formatUtcMonthKey(snap.timestamp);
    if (!keepSet.has(snap.key) && !coveredMonths.has(monthKey) && monthlyPicked.size < monthlyMax) {
      coveredMonths.add(monthKey);
      monthlyPicked.add(monthKey);
      keepSet.add(snap.key);
      tiers.monthly.push(snap.key);
    }
  }

  const keep = normalized.filter((s) => keepSet.has(s.key)).map((s) => s.key);
  const prune = normalized.filter((s) => !keepSet.has(s.key)).map((s) => s.key);

  return { keep, prune, tiers };
}

function hmacSha256(key, data) {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest();
}

function encodeRfc3986(str) {
  return encodeURIComponent(str).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

/**
 * Lightweight AWS SigV4 S3-compatible client supporting Cloudflare R2, AWS S3, and Backblaze B2.
 */
export class S3CompatibleStorage {
  constructor(config) {
    this.endpoint = config.endpoint.replace(/\/+$/, '');
    this.region = config.region || 'auto';
    this.bucket = config.bucket;
    this.accessKeyId = config.accessKeyId;
    this.secretAccessKey = config.secretAccessKey;
    this.fetchImpl = config.fetchImpl || globalThis.fetch;
  }

  async signedRequest(method, keyPath, queryParams = {}, body = Buffer.alloc(0), extraHeaders = {}) {
    const url = new URL(`${this.endpoint}/${this.bucket}${keyPath ? `/${keyPath.replace(/^\/+/, '')}` : ''}`);
    const sortedQuery = Object.entries(queryParams)
      .filter(([, v]) => v !== undefined && v !== null)
      .sort(([a], [b]) => a.localeCompare(b));
    for (const [k, v] of sortedQuery) {
      url.searchParams.set(k, String(v));
    }

    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);
    const payloadHash = computeSha256Hex(body);

    const headers = {
      host: url.host,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': payloadHash,
      ...extraHeaders,
    };

    const canonicalHeaders = Object.keys(headers)
      .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
      .map((k) => `${k.toLowerCase()}:${String(headers[k]).trim()}\n`)
      .join('');
    const signedHeaders = Object.keys(headers)
      .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
      .map((k) => k.toLowerCase())
      .join(';');

    const canonicalQuery = sortedQuery
      .map(([k, v]) => `${encodeRfc3986(k)}=${encodeRfc3986(String(v))}`)
      .join('&');

    const canonicalRequest = [
      method.toUpperCase(),
      url.pathname.split('/').map(encodeRfc3986).join('/') || '/',
      canonicalQuery,
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');

    const credentialScope = `${dateStamp}/${this.region}/s3/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      computeSha256Hex(canonicalRequest),
    ].join('\n');

    const kDate = hmacSha256(`AWS4${this.secretAccessKey}`, dateStamp);
    const kRegion = hmacSha256(kDate, this.region);
    const kService = hmacSha256(kRegion, 's3');
    const kSigning = hmacSha256(kService, 'aws4_request');
    const signature = crypto.createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');

    headers.authorization = `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const res = await this.fetchImpl(url.toString(), {
      method,
      headers,
      body: method === 'GET' || method === 'HEAD' || method === 'DELETE' ? undefined : body,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      throw new Error(`Object storage ${method} ${keyPath} failed (${res.status}): ${errText.slice(0, 200)}`);
    }
    return res;
  }

  async putObject(key, buffer, contentType = 'application/octet-stream') {
    await this.signedRequest('PUT', key, {}, buffer, { 'content-type': contentType });
  }

  async getObjectBuffer(key) {
    const res = await this.signedRequest('GET', key);
    return Buffer.from(await res.arrayBuffer());
  }

  async deleteObject(key) {
    await this.signedRequest('DELETE', key);
  }

  async listObjects(prefix = '') {
    const res = await this.signedRequest('GET', '', { 'list-type': '2', prefix });
    const xml = await res.text();
    const keys = [];
    const regex = /<Key>([^<]+)<\/Key>/g;
    let match;
    while ((match = regex.exec(xml)) !== null) {
      keys.push(match[1]);
    }
    return keys;
  }
}

export async function dispatchBackupAlert({ rule, severity, message, context = {} }) {
  const webhookUrl = process.env.ALERT_WEBHOOK_URL?.trim();
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const telegramChatId = process.env.TELEGRAM_CHAT_ID?.trim();

  const tasks = [];
  if (webhookUrl) {
    tasks.push(
      fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `[${severity.toUpperCase()}] Lakzee DB Backup (${rule}): ${message}`,
          rule,
          severity,
          message,
          context,
          timestamp: new Date().toISOString(),
        }),
      }).catch(() => undefined)
    );
  }

  if (telegramToken && telegramChatId) {
    tasks.push(
      fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: telegramChatId,
          text: `[${severity.toUpperCase()}] Lakzee DB (${rule})\n${message}`,
        }),
      }).catch(() => undefined)
    );
  }

  if (tasks.length > 0) {
    await Promise.allSettled(tasks);
  }
}
