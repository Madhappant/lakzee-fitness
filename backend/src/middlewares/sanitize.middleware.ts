/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response, NextFunction } from 'express';

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const PASSWORD_KEYS = new Set(['password', 'newPassword', 'currentPassword', 'confirmPassword']);

function sanitizeString(value: string): string {
  return value
    .replace(/\0/g, '')
    .replace(/<\s*(script|iframe|object|embed)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*\/?\s*(script|iframe|object|embed)\b[^>]*>/gi, '')
    .replace(/\bon\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript\s*:/gi, '');
}

/**
 * Recursively removes prototype-pollution keys, NoSQL operator keys (`$...`),
 * null bytes, and active script injection fragments while preserving password bytes intact.
 */
export function sanitizePayload(value: unknown, keyName?: string, depth = 0): any {
  if (depth > 15 || value === null || value === undefined) return value;

  if (typeof value === 'string') {
    if (keyName && PASSWORD_KEYS.has(keyName)) {
      return value.replace(/\0/g, '');
    }
    return sanitizeString(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizePayload(item, undefined, depth + 1));
  }

  if (typeof value === 'object' && Object.prototype.toString.call(value) === '[object Object]') {
    const clean: Record<string, any> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (DANGEROUS_KEYS.has(k) || k.startsWith('$')) {
        continue;
      }
      clean[k] = sanitizePayload(v, k, depth + 1);
    }
    return clean;
  }

  return value;
}

export function sanitizeInputs(req: Request, _res: Response, next: NextFunction) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizePayload(req.body);
  }
  if (req.params && typeof req.params === 'object') {
    for (const key of Object.keys(req.params)) {
      const val = req.params[key];
      if (typeof val === 'string') {
        req.params[key] = sanitizeString(val);
      }
    }
  }
  if (req.query && typeof req.query === 'object') {
    for (const key of Object.keys(req.query)) {
      if (DANGEROUS_KEYS.has(key) || key.startsWith('$')) {
        delete (req.query as Record<string, unknown>)[key];
        continue;
      }
      const val = (req.query as Record<string, unknown>)[key];
      if (typeof val === 'string') {
        (req.query as Record<string, unknown>)[key] = sanitizeString(val);
      }
    }
  }
  next();
}
