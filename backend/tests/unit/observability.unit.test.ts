import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { alertManager } from '../../src/utils/alerts';
import { SimpleMemoryCache } from '../../src/utils/cache';
import {
  errorTracker,
  parseSentryDsn,
  sanitizeTelemetryContext,
} from '../../src/utils/error-tracker';
import { logger } from '../../src/utils/logger';
import { normalizeRouteKey, telemetry } from '../../src/utils/telemetry';

describe('Observability Core: DSN Parsing, PII Scrubbing, APM Percentiles & Alerts', () => {
  const prevEnv = { ...process.env };

  beforeEach(() => {
    telemetry.reset();
    alertManager.reset();
    errorTracker.reset();
    process.env = { ...prevEnv };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = { ...prevEnv };
  });

  it('parses Sentry and GlitchTip DSN URLs cleanly and ignores malformed DSNs', () => {
    expect(parseSentryDsn('https://abc123key@o99.ingest.sentry.io/456789')).toEqual({
      envelopeUrl: 'https://o99.ingest.sentry.io/api/456789/envelope/',
      publicKey: 'abc123key',
    });

    expect(parseSentryDsn('https://glitchkey@errors.lakzee.fit/glitchtip/12')).toEqual({
      envelopeUrl: 'https://errors.lakzee.fit/glitchtip/api/12/envelope/',
      publicKey: 'glitchkey',
    });

    expect(parseSentryDsn('')).toBeNull();
    expect(parseSentryDsn('not-a-valid-dsn')).toBeNull();
  });

  it('redacts credentials, tokens, cookies, and PII from error tracker payloads before sending', async () => {
    process.env.SENTRY_DSN = 'https://pubtestkey@telemetry.lakzee.invalid/42';
    const capturedBodies: string[] = [];

    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        capturedBodies.push(String(init?.body ?? ''));
        return new Response(JSON.stringify({ id: 'ok' }), { status: 200 });
      })
    );

    const safe = sanitizeTelemetryContext({
      password: 'SecretPassword!99',
      authorization: 'Bearer secret.jwt.val',
      cookie: 'lakzee_refresh_token=rawtoken',
      email: 'member@lakzee.fit',
      phone: '9876543210',
      note: 'User admin@lakzee.fit hit bug',
    }) as Record<string, unknown>;

    expect(safe.password).toBe('[REDACTED]');
    expect(safe.authorization).toBe('[REDACTED]');
    expect(safe.cookie).toBe('[REDACTED]');
    expect(safe.email).toBe('[REDACTED_PII]');
    expect(safe.phone).toBe('[REDACTED_PII]');
    expect(safe.note).toBe('User [REDACTED_EMAIL] hit bug');

    errorTracker.captureException(new Error('Database failure for admin@lakzee.fit'), {
      source: 'backend',
      route: '/api/members',
      method: 'POST',
      statusCode: 500,
      userRole: 'ADMIN',
      payload: {
        email: 'secretuser@lakzee.fit',
        password: 'SuperSecretPassword',
        firstName: 'Aarav',
      },
    });

    await errorTracker.flush();
    expect(capturedBodies.length).toBe(1);
    expect(capturedBodies[0]).not.toContain('SuperSecretPassword');
    expect(capturedBodies[0]).not.toContain('secretuser@lakzee.fit');
    expect(capturedBodies[0]).not.toContain('admin@lakzee.fit');
    expect(capturedBodies[0]).toContain('[REDACTED]');
  });

  it('computes p50/p95/p99 APM latencies, slow-query warnings (>200ms) & cache hit rates', () => {
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});

    expect(normalizeRouteKey('/api/members/550e8400-e29b-41d4-a716-446655440000?sort=asc')).toBe(
      '/api/members/:id'
    );

    // Insert 20 deterministic samples: 10, 20, ..., 200 ms
    for (let i = 1; i <= 20; i++) {
      telemetry.recordHttpRequest({
        routePath: '/api/members',
        method: 'GET',
        statusCode: 200,
        durationMs: i * 10,
      });
    }

    const apm = telemetry.getApmSummary();
    expect(apm.totalRequests).toBe(20);
    expect(apm.p50Ms).toBe(100);
    expect(apm.p95Ms).toBe(190);
    expect(apm.p99Ms).toBe(200);
    expect(apm.statusCounts['2xx']).toBe(20);

    // Slow database query > 200ms triggers structured warning log cleanly
    telemetry.recordDbQuery(45, 'SELECT User', 200);
    expect(warnSpy).not.toHaveBeenCalled();

    telemetry.recordDbQuery(285.4, 'SELECT MemberProfile', 200);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(telemetry.getApmSummary().slowQueriesCount).toBe(1);

    const cache = new SimpleMemoryCache(10);
    cache.set('k1', 'v1', 60);
    expect(cache.get('k1')).toBe('v1'); // hit
    expect(cache.get('k2')).toBeNull(); // miss
    expect(cache.getStats()).toMatchObject({ hits: 1, misses: 1, hitRatePercent: 50 });
  });

  it('dispatches deduplicated webhook alerts on error spikes, auth brute-force & health outages', async () => {
    process.env.ALERT_WEBHOOK_URL = 'https://hooks.lakzee.invalid/sre-alerts';
    process.env.ALERT_COOLDOWN_MS = '60000';

    const webhookCalls: Array<{ url: string; body: string }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        webhookCalls.push({ url, body: String(init?.body ?? '') });
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      })
    );

    // 5 errors within 60s triggers SERVER_ERROR_SPIKE once cleanly (deduped by cooldown)
    for (let i = 0; i < 6; i++) {
      telemetry.recordHttpRequest({
        routePath: '/api/reports',
        method: 'GET',
        statusCode: 500,
        durationMs: 25,
      });
    }

    // 5 auth failures within 120s triggers BRUTE_FORCE_AUTH_SPIKE
    for (let i = 0; i < 5; i++) {
      telemetry.recordHttpRequest({
        routePath: '/api/auth/login',
        method: 'POST',
        statusCode: 401,
        durationMs: 12,
      });
    }

    telemetry.recordHealthFailure('ECONNREFUSED');

    await alertManager.flush();

    const rules = alertManager.getRecentAlerts(10).map((a) => a.rule);
    expect(rules).toContain('SERVER_ERROR_SPIKE');
    expect(rules).toContain('BRUTE_FORCE_AUTH_SPIKE');
    expect(rules).toContain('HEALTH_CHECK_FAILED');
    expect(webhookCalls.length).toBe(3);
  });
});
