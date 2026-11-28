import crypto from 'crypto';
import { securityEnv } from '../../config/env';
import { BadRequestError } from '../../utils/errors';

export interface RenewalTokenPayload {
  memberProfileId: string;
  branchId: string;
  planId?: string;
  iat: number;
  exp: number;
}

const DEFAULT_RENEWAL_TTL_SECONDS = 72 * 60 * 60; // 72 hours

function getRenewalSigningSecret(): string {
  const explicit = process.env.RENEWAL_TOKEN_SECRET?.trim();
  if (explicit) return explicit;
  return crypto
    .createHmac('sha256', securityEnv.jwtAccessSecret)
    .update('lakzee-renewal-link-domain-v1')
    .digest('hex');
}

function signPayloadEncoded(encodedPayload: string): string {
  return crypto
    .createHmac('sha256', getRenewalSigningSecret())
    .update(encodedPayload)
    .digest('base64url');
}

/**
 * Generates a short-lived, tamper-proof HMAC-SHA256 signed token for one-click renewal links.
 */
export function createRenewalLinkToken(params: {
  memberProfileId: string;
  branchId: string;
  planId?: string | null;
  ttlSeconds?: number;
  nowMs?: number;
}): string {
  const nowSeconds = Math.floor((params.nowMs ?? Date.now()) / 1000);
  const ttl = Math.max(60, Math.floor(params.ttlSeconds ?? DEFAULT_RENEWAL_TTL_SECONDS));

  const payload: RenewalTokenPayload = {
    memberProfileId: params.memberProfileId,
    branchId: params.branchId,
    ...(params.planId ? { planId: params.planId } : {}),
    iat: nowSeconds,
    exp: nowSeconds + ttl,
  };

  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = signPayloadEncoded(encoded);
  return `${encoded}.${sig}`;
}

/**
 * Verifies a signed renewal token using constant-time HMAC comparison and expiration bounds.
 */
export function verifyRenewalLinkToken(
  token: string,
  nowMs: number = Date.now()
): RenewalTokenPayload {
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    throw new BadRequestError('Invalid renewal link token', 'INVALID_RENEWAL_TOKEN');
  }

  const parts = token.trim().split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new BadRequestError('Malformed renewal link token', 'INVALID_RENEWAL_TOKEN');
  }

  const [encodedPayload, providedSig] = parts;
  const expectedSig = signPayloadEncoded(encodedPayload);

  const providedBuf = Buffer.from(providedSig, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (providedBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(providedBuf, expectedBuf)) {
    throw new BadRequestError('Renewal link signature verification failed', 'INVALID_RENEWAL_TOKEN');
  }

  let parsed: RenewalTokenPayload;
  try {
    parsed = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as RenewalTokenPayload;
  } catch {
    throw new BadRequestError('Corrupted renewal link payload', 'INVALID_RENEWAL_TOKEN');
  }

  if (!parsed?.memberProfileId || !parsed?.branchId || typeof parsed.exp !== 'number') {
    throw new BadRequestError('Incomplete renewal link payload', 'INVALID_RENEWAL_TOKEN');
  }

  const nowSeconds = Math.floor(nowMs / 1000);
  if (nowSeconds >= parsed.exp) {
    throw new BadRequestError('This renewal link has expired. Please request a new link.', 'RENEWAL_TOKEN_EXPIRED');
  }

  return parsed;
}

/**
 * Resolves the primary frontend origin to construct member-facing one-click /renew links.
 */
export function buildRenewalUrl(token: string): string {
  const rawOrigins = (process.env.CLIENT_URL || 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const baseUrl = (rawOrigins[0] || 'http://localhost:3000').replace(/\/+$/, '');
  return `${baseUrl}/renew?token=${encodeURIComponent(token)}`;
}
