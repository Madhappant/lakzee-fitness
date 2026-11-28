/* eslint-disable @typescript-eslint/no-explicit-any */
import { securityEnv } from '../config/env';

const SENSITIVE_KEY_PATTERN =
  /pass(word)?|token|secret|authorization|cookie|otp|apikey|api_key|jwt|connection|database_url|direct_url/i;

const MAX_REDACT_DEPTH = 8;

export function redactSensitiveData(value: unknown, depth = 0): unknown {
  if (depth > MAX_REDACT_DEPTH || value === null || value === undefined) return value;

  if (typeof value === 'string') {
    if (value.startsWith('Bearer ')) {
      return 'Bearer [REDACTED]';
    }
    return value;
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      ...(securityEnv.isProduction ? {} : { stack: value.stack }),
    };
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveData(item, depth + 1));
  }

  if (typeof value === 'object') {
    const clean: Record<string, any> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        clean[key] = '[REDACTED]';
      } else {
        clean[key] = redactSensitiveData(val, depth + 1);
      }
    }
    return clean;
  }

  return value;
}

type LogLevel = 'info' | 'warn' | 'error';

function writeLog(level: LogLevel, msg: string, context?: Record<string, unknown>) {
  const entry = {
    level,
    timestamp: new Date().toISOString(),
    service: 'lakzee-backend',
    env: securityEnv.nodeEnv,
    msg,
    ...(context ? (redactSensitiveData(context) as Record<string, unknown>) : {}),
  };

  const serialized = JSON.stringify(entry);
  if (level === 'error') {
    process.stderr.write(`${serialized}\n`);
  } else {
    process.stdout.write(`${serialized}\n`);
  }
}

export const logger = {
  info: (msg: string, context?: Record<string, unknown>) => writeLog('info', msg, context),
  warn: (msg: string, context?: Record<string, unknown>) => writeLog('warn', msg, context),
  error: (msg: string, context?: Record<string, unknown>) => writeLog('error', msg, context),
};
