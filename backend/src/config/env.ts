import crypto from 'crypto';

if (!process.env.JWT_SECRET || !process.env.JWT_SECRET.trim()) {
  throw new Error('FATAL: JWT_SECRET environment variable is required and cannot be empty.');
}

if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL) {
  throw new Error('FATAL: DATABASE_URL environment variable is required in production.');
}

const configuredOrigins = (process.env.CLIENT_URL || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const devOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
];

const resolvedJwtSecret = process.env.JWT_SECRET.trim();

/**
 * Loads JWT_REFRESH_SECRET from env when configured, otherwise derives an isolated
 * HMAC-SHA256 refresh key from JWT_SECRET so access and refresh tokens never share a key.
 */
const resolvedRefreshSecret = process.env.JWT_REFRESH_SECRET?.trim()
  ? process.env.JWT_REFRESH_SECRET.trim()
  : crypto.createHmac('sha256', resolvedJwtSecret).update('lakzee-refresh-token-domain-v1').digest('hex');

export const securityEnv = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  jwtAccessSecret: resolvedJwtSecret,
  jwtRefreshSecret: resolvedRefreshSecret,
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  refreshCookieMaxAgeMs: 7 * 24 * 60 * 60 * 1000,
  bcryptCostFactor: 12,
  allowedOrigins:
    process.env.NODE_ENV === 'production'
      ? configuredOrigins
      : Array.from(new Set([...devOrigins, ...configuredOrigins])),
} as const;

export function isAllowedOrigin(origin?: string | null): boolean {
  if (!origin) return false;
  try {
    const normalized = new URL(origin).origin;
    return securityEnv.allowedOrigins.some((candidate) => {
      try {
        return new URL(candidate).origin === normalized;
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}
