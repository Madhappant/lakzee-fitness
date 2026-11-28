import { Request, Response } from 'express';
import { securityEnv } from '../config/env';

export const REFRESH_COOKIE_NAME = 'lakzee_refresh_token';

export function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.cookie;
  if (!header) return {};

  const cookies: Record<string, string> = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const rawVal = part.slice(idx + 1).trim();
    try {
      cookies[key] = decodeURIComponent(rawVal);
    } catch {
      cookies[key] = rawVal;
    }
  }
  return cookies;
}

function resolveRefreshCookieOptions(req: Request) {
  const origin = req.headers.origin;
  const host = req.headers.host;
  let isCrossOrigin = false;

  if (origin && host) {
    try {
      isCrossOrigin = new URL(origin).host !== host;
    } catch {
      isCrossOrigin = true;
    }
  }

  const sameSite: 'strict' | 'lax' | 'none' = securityEnv.isProduction
    ? isCrossOrigin
      ? 'none'
      : 'strict'
    : 'lax';

  return {
    httpOnly: true,
    secure: securityEnv.isProduction,
    sameSite,
    path: '/api/auth',
  } as const;
}

export function setRefreshCookie(req: Request, res: Response, refreshToken: string) {
  const opts = resolveRefreshCookieOptions(req);
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    ...opts,
    maxAge: securityEnv.refreshCookieMaxAgeMs,
  });
}

export function clearRefreshCookie(req: Request, res: Response) {
  const opts = resolveRefreshCookieOptions(req);
  res.clearCookie(REFRESH_COOKIE_NAME, opts);
}
