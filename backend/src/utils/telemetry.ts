import { alertManager } from './alerts';
import { logger } from './logger';

interface RequestSample {
  timestamp: number;
  durationMs: number;
  statusCode: number;
  routeKey: string;
}

export interface SlowQueryEntry {
  timestamp: string;
  durationMs: number;
  thresholdMs: number;
  target: string;
}

export interface WebVitalSample {
  name: 'LCP' | 'INP' | 'CLS' | 'FCP' | 'TTFB';
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  route: string;
  timestamp: string;
}

const MAX_REQUEST_SAMPLES = 500;
const MAX_SLOW_QUERIES = 50;
const MAX_WEB_VITAL_SAMPLES = 150;
const SPIKE_WINDOW_MS = 60 * 1000;
const AUTH_WINDOW_MS = 2 * 60 * 1000;

const ERROR_SPIKE_THRESHOLD = Number(process.env.ERROR_SPIKE_THRESHOLD || 5);
const AUTH_SPIKE_THRESHOLD = Number(process.env.AUTH_SPIKE_THRESHOLD || 5);
const HIGH_LATENCY_AVG_THRESHOLD_MS = Number(process.env.HIGH_LATENCY_THRESHOLD_MS || 1000);

function computePercentile(sortedValues: readonly number[], percentile: number): number {
  if (sortedValues.length === 0) return 0;
  const idx = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.ceil((percentile / 100) * sortedValues.length) - 1)
  );
  return Math.round(sortedValues[idx] * 100) / 100;
}

export function normalizeRouteKey(rawPath: string): string {
  const pathOnly = rawPath.split('?')[0] || '/';
  return pathOnly
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
    .replace(/\/[0-9]+(?=\/|$)/g, '/:num')
    .replace(/\/LZ-[0-9A-Za-z-]+(?=\/|$)/gi, '/:memberId');
}

class TelemetryRegistry {
  private requestSamples: RequestSample[] = [];
  private statusCounts: Record<'2xx' | '3xx' | '4xx' | '5xx', number> = {
    '2xx': 0,
    '3xx': 0,
    '4xx': 0,
    '5xx': 0,
  };
  private totalRequests = 0;
  private serverErrorTimestamps: number[] = [];
  private authFailureTimestamps: number[] = [];
  private rateLimitHits = 0;

  private dbQueryCount = 0;
  private slowQueryCount = 0;
  private slowQueries: SlowQueryEntry[] = [];

  private webVitals: Record<WebVitalSample['name'], WebVitalSample[]> = {
    LCP: [],
    INP: [],
    CLS: [],
    FCP: [],
    TTFB: [],
  };
  private frontendErrorCount = 0;

  recordHttpRequest(params: { routePath: string; method: string; statusCode: number; durationMs: number }): void {
    const now = Date.now();
    const routeKey = `${params.method.toUpperCase()} ${normalizeRouteKey(params.routePath)}`;

    this.totalRequests += 1;
    if (params.statusCode >= 500) this.statusCounts['5xx'] += 1;
    else if (params.statusCode >= 400) this.statusCounts['4xx'] += 1;
    else if (params.statusCode >= 300) this.statusCounts['3xx'] += 1;
    else this.statusCounts['2xx'] += 1;

    if (this.requestSamples.length >= MAX_REQUEST_SAMPLES) {
      this.requestSamples.shift();
    }
    this.requestSamples.push({
      timestamp: now,
      durationMs: params.durationMs,
      statusCode: params.statusCode,
      routeKey,
    });

    if (params.statusCode >= 500) {
      this.serverErrorTimestamps = this.serverErrorTimestamps.filter((ts) => now - ts <= SPIKE_WINDOW_MS);
      this.serverErrorTimestamps.push(now);
      if (this.serverErrorTimestamps.length >= ERROR_SPIKE_THRESHOLD) {
        alertManager.trigger({
          rule: 'SERVER_ERROR_SPIKE',
          severity: 'critical',
          title: '5xx Server Error Spike Detected',
          message: `${this.serverErrorTimestamps.length} server errors recorded within the last 60s (latest: ${routeKey}).`,
          context: { routeKey, count60s: this.serverErrorTimestamps.length },
        });
      }
    }

    if (params.statusCode === 429) {
      this.rateLimitHits += 1;
    }

    const isAuthAttempt =
      routeKey.includes('/api/auth/login') || routeKey.includes('/api/auth/reset-password');
    if (isAuthAttempt && (params.statusCode === 401 || params.statusCode === 429)) {
      this.recordAuthFailure(routeKey, params.statusCode);
    }

    const recentWindow = this.requestSamples.slice(-20);
    if (recentWindow.length >= 10) {
      const avgRecent =
        recentWindow.reduce((sum, item) => sum + item.durationMs, 0) / recentWindow.length;
      if (avgRecent > HIGH_LATENCY_AVG_THRESHOLD_MS) {
        alertManager.trigger({
          rule: 'HIGH_API_LATENCY',
          severity: 'warning',
          title: 'Sustained High API Latency',
          message: `Rolling API latency averaged ${Math.round(avgRecent)}ms across recent ${recentWindow.length} requests.`,
          context: { avgMs: Math.round(avgRecent), latestRoute: routeKey },
        });
      }
    }
  }

  recordAuthFailure(routeKey: string, statusCode: number): void {
    const now = Date.now();
    this.authFailureTimestamps = this.authFailureTimestamps.filter((ts) => now - ts <= AUTH_WINDOW_MS);
    this.authFailureTimestamps.push(now);

    if (statusCode === 429 || this.authFailureTimestamps.length >= AUTH_SPIKE_THRESHOLD) {
      alertManager.trigger({
        rule: 'BRUTE_FORCE_AUTH_SPIKE',
        severity: statusCode === 429 ? 'critical' : 'warning',
        title: 'Repeated Authentication Failures / Brute-Force Signal',
        message: `${this.authFailureTimestamps.length} auth failures in rolling 120s window (status ${statusCode} on ${routeKey}).`,
        context: { count120s: this.authFailureTimestamps.length, statusCode, routeKey },
      });
    }
  }

  recordDbQuery(durationMs: number, target: string, thresholdMs = 200): void {
    this.dbQueryCount += 1;
    if (durationMs > thresholdMs) {
      this.slowQueryCount += 1;
      const entry: SlowQueryEntry = {
        timestamp: new Date().toISOString(),
        durationMs: Math.round(durationMs * 100) / 100,
        thresholdMs,
        target,
      };
      if (this.slowQueries.length >= MAX_SLOW_QUERIES) {
        this.slowQueries.shift();
      }
      this.slowQueries.push(entry);

      logger.warn('slow_database_query', {
        target,
        durationMs: entry.durationMs,
        thresholdMs,
      });
    }
  }

  recordHealthFailure(reason: string): void {
    alertManager.trigger({
      rule: 'HEALTH_CHECK_FAILED',
      severity: 'critical',
      title: 'Health Check Probe Failed',
      message: `API / Database readiness check failed: ${reason}`,
    });
  }

  recordClientWebVital(sample: Omit<WebVitalSample, 'timestamp'>): void {
    const bucket = this.webVitals[sample.name];
    if (!bucket) return;
    if (bucket.length >= MAX_WEB_VITAL_SAMPLES) {
      bucket.shift();
    }
    bucket.push({
      name: sample.name,
      value: Math.round(sample.value * 1000) / 1000,
      rating: sample.rating,
      route: normalizeRouteKey(sample.route || '/'),
      timestamp: new Date().toISOString(),
    });
  }

  recordFrontendError(): void {
    this.frontendErrorCount += 1;
  }

  getApmSummary() {
    const durations = this.requestSamples.map((s) => s.durationMs).sort((a, b) => a - b);
    const avgMs =
      durations.length > 0
        ? Math.round((durations.reduce((acc, v) => acc + v, 0) / durations.length) * 100) / 100
        : 0;
    const maxMs = durations.length > 0 ? Math.round(durations[durations.length - 1] * 100) / 100 : 0;

    return {
      totalRequests: this.totalRequests,
      sampleCount: durations.length,
      p50Ms: computePercentile(durations, 50),
      p95Ms: computePercentile(durations, 95),
      p99Ms: computePercentile(durations, 99),
      avgMs,
      maxMs,
      statusCounts: { ...this.statusCounts },
      authFailuresRollingCount: this.authFailureTimestamps.length,
      rateLimitHits: this.rateLimitHits,
      dbQueryCount: this.dbQueryCount,
      slowQueriesCount: this.slowQueryCount,
      recentSlowQueries: this.slowQueries.slice(-10).reverse(),
    };
  }

  getWebVitalsSummary() {
    const summarize = (name: WebVitalSample['name']) => {
      const vals = this.webVitals[name].map((v) => v.value).sort((a, b) => a - b);
      return {
        samples: vals.length,
        p75: computePercentile(vals, 75),
      };
    };

    return {
      lcp: summarize('LCP'),
      inp: summarize('INP'),
      cls: summarize('CLS'),
      fcp: summarize('FCP'),
      ttfb: summarize('TTFB'),
      frontendErrorCount: this.frontendErrorCount,
    };
  }

  reset(): void {
    this.requestSamples = [];
    this.statusCounts = { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0 };
    this.totalRequests = 0;
    this.serverErrorTimestamps = [];
    this.authFailureTimestamps = [];
    this.rateLimitHits = 0;
    this.dbQueryCount = 0;
    this.slowQueryCount = 0;
    this.slowQueries = [];
    this.webVitals = { LCP: [], INP: [], CLS: [], FCP: [], TTFB: [] };
    this.frontendErrorCount = 0;
  }
}

export const telemetry = new TelemetryRegistry();
