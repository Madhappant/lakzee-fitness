import { Request, Response } from 'express';
import { isAllowedOrigin, securityEnv } from '../config/env';
import { AuthRequest } from '../middlewares/auth.middleware';
import { asyncHandler } from '../middlewares/error.middleware';
import { auditService } from '../services/audit.service';
import { authService } from '../services/auth.service';
import { clearRefreshCookie, parseCookies, REFRESH_COOKIE_NAME, setRefreshCookie } from '../utils/cookies';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';
import { verifyAccessToken } from '../utils/jwt';
import { sendSuccess } from '../utils/response';

function getSessionMeta(req: Request) {
  return {
    userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'].slice(0, 250) : undefined,
    ipAddress: req.ip,
  };
}

function assertSafeCookieOrigin(req: Request) {
  if (!securityEnv.isProduction) return;
  const origin = req.headers.origin;
  if (origin && !isAllowedOrigin(origin)) {
    throw new ForbiddenError('Blocked cross-site refresh attempt');
  }
}

export const register = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.register(req.body, getSessionMeta(req));
  setRefreshCookie(req, res, result.refreshToken);
  return sendSuccess(res, {
    statusCode: 201,
    data: {
      user: result.user,
      token: result.accessToken,
      accessToken: result.accessToken,
    },
  });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  try {
    const result = await authService.login(req.body, getSessionMeta(req));
    setRefreshCookie(req, res, result.refreshToken);

    if (result.user.role !== 'MEMBER') {
      auditService.record({
        branchId: result.user.branchId,
        actorId: result.user.id,
        actorRole: result.user.role,
        action: 'ADMIN_LOGIN',
        targetId: result.user.id,
        ipAddress: req.ip,
        description: `Authenticated ${result.user.role} session started`,
      });
    }

    return sendSuccess(res, {
      data: {
        user: result.user,
        token: result.accessToken,
        accessToken: result.accessToken,
      },
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      auditService.record({
        action: 'LOGIN_FAILED',
        ipAddress: req.ip,
        description: 'Failed authentication attempt',
        metadata: { email: typeof req.body?.email === 'string' ? req.body.email : undefined },
      });
    }
    throw err;
  }
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  assertSafeCookieOrigin(req);
  const cookies = parseCookies(req);
  const rawRefreshToken = cookies[REFRESH_COOKIE_NAME];

  const result = await authService.refreshSession(rawRefreshToken, getSessionMeta(req));
  setRefreshCookie(req, res, result.refreshToken);

  return sendSuccess(res, {
    data: {
      user: result.user,
      token: result.accessToken,
      accessToken: result.accessToken,
    },
  });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  assertSafeCookieOrigin(req);
  const cookies = parseCookies(req);
  const rawRefreshToken = cookies[REFRESH_COOKIE_NAME];

  let userId: string | undefined;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      userId = verifyAccessToken(authHeader.slice(7).trim()).id;
    } catch {
      // Access token may already be expired during logout
    }
  }

  await authService.logoutSession(rawRefreshToken, userId);
  clearRefreshCookie(req, res);

  return sendSuccess(res, { message: 'Logged out successfully' });
});

export const requestOtp = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.requestPasswordOtp(req.body.email);
  return sendSuccess(res, {
    data: { phoneMasked: result.phoneMasked ?? null },
    message: result.message,
  });
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  await authService.resetPassword(req.body);
  return sendSuccess(res, { message: 'Password reset successfully' });
});

export const requestPhoneOtp = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await authService.requestPhoneOtp(req.user?.id, req.body);
  return sendSuccess(res, {
    data: { phoneMasked: result.phoneMasked },
    message: result.message,
  });
});

export const verifyPhoneOtp = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await authService.verifyPhoneOtp(req.user?.id, req.body);
  return sendSuccess(res, {
    message: 'Phone number updated successfully',
    data: { user },
  });
});
