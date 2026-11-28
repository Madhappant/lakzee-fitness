import { describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import { isAllowedOrigin, securityEnv } from '../../src/config/env';
import { roleHasPermission } from '../../src/middlewares/auth.middleware';
import { sanitizePayload } from '../../src/middlewares/sanitize.middleware';
import {
  generateAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from '../../src/utils/jwt';
import { redactSensitiveData } from '../../src/utils/logger';

describe('Security Utilities: Sanitization, Log Redaction, JWT Isolation & RBAC', () => {
  it('strips XSS scripts, NoSQL operators, and prototype-pollution keys while keeping password intact', () => {
    const clean = sanitizePayload(
      JSON.parse(
        JSON.stringify({
          firstName: '<script>alert(1)</script>Karthik',
          bio: 'javascript:void(0)',
          $gt: '',
          nested: { $ne: null, goal: '<img onerror="hack()" src=x>Strength' },
          password: 'Keep<$>Password!2026',
          __proto__: { polluted: true },
        })
      )
    );

    expect(clean.firstName).toBe('Karthik');
    expect(clean.bio).toBe('void(0)');
    expect('$gt' in clean).toBe(false);
    expect('$ne' in clean.nested).toBe(false);
    expect(clean.nested.goal).not.toContain('onerror=');
    expect(clean.password).toBe('Keep<$>Password!2026');
    expect(Object.prototype.hasOwnProperty.call(clean, '__proto__')).toBe(false);
  });

  it('redacts sensitive secrets, tokens, cookies, OTPs, and Bearer headers from logs', () => {
    const safe = redactSensitiveData({
      email: 'admin@lakzee.fit',
      password: 'PlaintextPassword',
      accessToken: 'eyJhbGci.access',
      authorization: 'Bearer secret.jwt.token',
      cookie: 'lakzee_refresh_token=raw',
      resetOtp: '123456',
      nested: { jwtSecret: 'top-secret', service: 'api' },
    }) as Record<string, unknown>;

    expect(safe.email).toBe('admin@lakzee.fit');
    expect(safe.password).toBe('[REDACTED]');
    expect(safe.accessToken).toBe('[REDACTED]');
    expect(safe.authorization).toBe('[REDACTED]');
    expect(safe.cookie).toBe('[REDACTED]');
    expect(safe.resetOtp).toBe('[REDACTED]');
    expect((safe.nested as Record<string, unknown>).jwtSecret).toBe('[REDACTED]');
    expect((safe.nested as Record<string, unknown>).service).toBe('api');
  });

  it('isolates access and refresh JWT verification and rejects expired tokens', () => {
    const access = generateAccessToken({ id: 'admin-1', role: 'ADMIN' });
    const refresh = generateRefreshToken({ id: 'admin-1', role: 'ADMIN' }, 'jti-1', 'fam-1');

    expect(verifyAccessToken(access)).toMatchObject({ id: 'admin-1', role: 'ADMIN', tokenType: 'access' });
    expect(verifyRefreshToken(refresh)).toMatchObject({
      id: 'admin-1',
      role: 'ADMIN',
      jti: 'jti-1',
      familyId: 'fam-1',
      tokenType: 'refresh',
    });

    // Cross-token usage must fail strictly
    expect(() => verifyAccessToken(refresh)).toThrow();
    expect(() => verifyRefreshToken(access)).toThrow();

    // Expired access token must be rejected
    const expiredAccess = jwt.sign(
      { id: 'admin-1', role: 'ADMIN', tokenType: 'access' },
      securityEnv.jwtAccessSecret,
      { expiresIn: -10 }
    );
    expect(() => verifyAccessToken(expiredAccess)).toThrow(/expired/i);

    // Hashing produces deterministic 64-char SHA-256 hex
    expect(hashRefreshToken(refresh)).toMatch(/^[a-f0-9]{64}$/);
  });

  it('enforces RBAC role hierarchy and trusted CORS origins', () => {
    expect(roleHasPermission('SUPER_ADMIN', ['ADMIN'])).toBe(true);
    expect(roleHasPermission('ADMIN', ['RECEPTIONIST'])).toBe(true);
    expect(roleHasPermission('TRAINER', ['ADMIN'])).toBe(false);
    expect(roleHasPermission('MEMBER', ['STAFF'])).toBe(false);

    expect(isAllowedOrigin('http://localhost:3000')).toBe(true);
    expect(isAllowedOrigin('https://evil.attacker.invalid')).toBe(false);
    expect(isAllowedOrigin(null)).toBe(false);
  });
});
