import crypto from 'crypto';
import { logger, redactSensitiveData } from './logger';

interface ParsedSentryDsn {
  envelopeUrl: string;
  publicKey: string;
}

export interface ErrorCaptureContext {
  route?: string;
  method?: string;
  statusCode?: number;
  userRole?: string;
  userId?: string;
  payload?: unknown;
  source?: 'backend' | 'unhandledRejection' | 'uncaughtException' | 'frontend';
  extra?: Record<string, unknown>;
}

export interface CapturedErrorSummary {
  eventId: string;
  timestamp: string;
  name: string;
  message: string;
  route?: string;
  method?: string;
  statusCode?: number;
  source: string;
}

const MAX_CAPTURED_HISTORY = 50;
const PII_STRING_KEY_PATTERN = /email|phone|mobile|whatsapp|address|emergency/i;

/**
 * Strips authentication credentials from error context AND masks direct PII fields
 * (emails, phone numbers, addresses) before transmitting telemetry outside the server.
 */
export function sanitizeTelemetryContext(value: unknown, depth = 0): unknown {
  const baseRedacted = redactSensitiveData(value, depth);
  if (depth > 8 || baseRedacted === null || baseRedacted === undefined) return baseRedacted;
  if (typeof baseRedacted === 'string') {
    return baseRedacted
      .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
      .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[REDACTED_EMAIL]');
  }
  if (Array.isArray(baseRedacted)) {
    return baseRedacted.map((item) => sanitizeTelemetryContext(item, depth + 1));
  }
  if (typeof baseRedacted === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(baseRedacted as Record<string, unknown>)) {
      if (PII_STRING_KEY_PATTERN.test(k)) {
        out[k] = '[REDACTED_PII]';
      } else {
        out[k] = sanitizeTelemetryContext(v, depth + 1);
      }
    }
    return out;
  }
  return baseRedacted;
}

export function parseSentryDsn(rawDsn?: string): ParsedSentryDsn | null {
  if (!rawDsn || !rawDsn.trim()) return null;
  try {
    const url = new URL(rawDsn.trim());
    const publicKey = url.username;
    const pathSegments = url.pathname.split('/').filter(Boolean);
    const projectId = pathSegments.pop();
    if (!publicKey || !projectId) return null;

    const basePath = pathSegments.length > 0 ? `/${pathSegments.join('/')}` : '';
    const envelopeUrl = `${url.protocol}//${url.host}${basePath}/api/${projectId}/envelope/`;
    return { envelopeUrl, publicKey };
  } catch {
    return null;
  }
}

class ErrorTracker {
  private capturedHistory: CapturedErrorSummary[] = [];
  private pendingTransmissions = new Set<Promise<void>>();

  captureException(err: unknown, context: ErrorCaptureContext = {}): string {
    const eventId = crypto.randomUUID().replace(/-/g, '');
    const nowIso = new Date().toISOString();
    const errName = err instanceof Error ? err.name : 'Error';
    const errMessage = err instanceof Error ? err.message : String(err ?? 'Unknown error');
    const errStack =
      err instanceof Error && err.stack ? String(sanitizeTelemetryContext(err.stack)) : undefined;

    const summary: CapturedErrorSummary = {
      eventId,
      timestamp: nowIso,
      name: errName,
      message: errMessage.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[REDACTED_EMAIL]'),
      route: context.route,
      method: context.method,
      statusCode: context.statusCode,
      source: context.source ?? 'backend',
    };

    if (this.capturedHistory.length >= MAX_CAPTURED_HISTORY) {
      this.capturedHistory.shift();
    }
    this.capturedHistory.push(summary);

    const parsedDsn = parseSentryDsn(process.env.SENTRY_DSN);
    if (!parsedDsn) {
      return eventId;
    }

    const sanitizedPayload = context.payload !== undefined ? sanitizeTelemetryContext(context.payload) : undefined;
    const sanitizedExtra = context.extra ? (sanitizeTelemetryContext(context.extra) as Record<string, unknown>) : {};

    const envelopeEvent = {
      event_id: eventId,
      timestamp: nowIso,
      platform: 'node',
      level: 'error',
      environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'production',
      tags: {
        service: 'lakzee-backend',
        source: summary.source,
        ...(context.method ? { method: context.method } : {}),
        ...(context.route ? { route: context.route } : {}),
        ...(context.userRole ? { role: context.userRole } : {}),
        ...(context.statusCode ? { status_code: String(context.statusCode) } : {}),
      },
      exception: {
        values: [
          {
            type: errName,
            value: summary.message,
            ...(errStack ? { stacktrace_text: errStack } : {}),
          },
        ],
      },
      extra: {
        ...sanitizedExtra,
        ...(sanitizedPayload !== undefined ? { payload: sanitizedPayload } : {}),
      },
    };

    const envelopeBody = `${JSON.stringify({ event_id: eventId, sent_at: nowIso })}\n${JSON.stringify({ type: 'event' })}\n${JSON.stringify(envelopeEvent)}`;

    const job = Promise.resolve().then(async () => {
      try {
        await fetch(parsedDsn.envelopeUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-sentry-envelope',
            'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${parsedDsn.publicKey}, sentry_client=lakzee-sre/1.0`,
          },
          body: envelopeBody,
          signal: AbortSignal.timeout(3000),
        });
      } catch (sendErr) {
        logger.warn('External error tracker transmission skipped', {
          reason: sendErr instanceof Error ? sendErr.message : 'network error',
        });
      }
    });

    this.pendingTransmissions.add(job);
    void job.finally(() => {
      this.pendingTransmissions.delete(job);
    });

    return eventId;
  }

  getRecentCapturedErrors(limit = 20): CapturedErrorSummary[] {
    return this.capturedHistory.slice(-limit).reverse();
  }

  async flush(): Promise<void> {
    if (this.pendingTransmissions.size > 0) {
      await Promise.allSettled([...this.pendingTransmissions]);
    }
  }

  reset(): void {
    this.capturedHistory = [];
  }
}

export const errorTracker = new ErrorTracker();
