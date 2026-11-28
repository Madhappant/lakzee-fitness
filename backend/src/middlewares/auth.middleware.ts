import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { prisma } from '../config/prisma';
import { CACHE_KEYS, memoryCache } from '../utils/cache';
import { ForbiddenError } from '../utils/errors';
import {
  PRIMARY_BRANCH_ID,
  resolveTenantScope,
  type TenantScope,
} from '../utils/tenant';

export const APP_ROLES = [
  'SUPER_ADMIN',
  'BRANCH_ADMIN',
  'ADMIN',
  'RECEPTIONIST',
  'TRAINER',
  'STAFF',
  'MEMBER',
] as const;

export type AppRole = (typeof APP_ROLES)[number];

/**
 * Defines inherited permissions so SUPER_ADMIN oversees global/all-branch operations
 * while BRANCH_ADMIN / ADMIN retain full operational authority within their locked branch.
 */
const ROLE_IMPLIED_PERMISSIONS: Record<string, Set<string>> = {
  SUPER_ADMIN: new Set(['SUPER_ADMIN', 'BRANCH_ADMIN', 'ADMIN', 'RECEPTIONIST', 'TRAINER', 'STAFF']),
  BRANCH_ADMIN: new Set(['BRANCH_ADMIN', 'ADMIN', 'RECEPTIONIST', 'TRAINER', 'STAFF']),
  ADMIN: new Set(['ADMIN', 'BRANCH_ADMIN', 'RECEPTIONIST', 'TRAINER', 'STAFF']),
  RECEPTIONIST: new Set(['RECEPTIONIST', 'STAFF']),
  TRAINER: new Set(['TRAINER', 'STAFF']),
  STAFF: new Set(['STAFF']),
  MEMBER: new Set(['MEMBER']),
};

export interface AuthRequest extends Request {
  user?: {
    id: string;
    role: string;
    branchId: string;
  };
  tenant?: TenantScope;
}

interface CachedAuthUser {
  id: string;
  role: string;
  branchId: string;
}

const AUTH_CACHE_TTL_SECONDS = 5;

export function roleHasPermission(userRole: string, requiredRoles: readonly string[]): boolean {
  const effective = ROLE_IMPLIED_PERMISSIONS[userRole] ?? new Set([userRole]);
  return requiredRoles.some((role) => effective.has(role));
}

function extractRequestedBranchParam(req: Request): unknown {
  const headerBranch = req.headers['x-branch-id'];
  if (typeof headerBranch === 'string' && headerBranch.trim()) {
    return headerBranch.trim();
  }
  if (typeof req.query?.branchId === 'string' && req.query.branchId.trim()) {
    return req.query.branchId.trim();
  }
  if (
    req.body &&
    typeof req.body === 'object' &&
    'branchId' in req.body &&
    typeof (req.body as { branchId?: unknown }).branchId === 'string'
  ) {
    return (req.body as { branchId: string }).branchId.trim();
  }
  return undefined;
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, status: 'error', message: 'Unauthorized, no token' });
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      return res.status(401).json({ success: false, status: 'error', message: 'Unauthorized, no token' });
    }

    const decoded = verifyAccessToken(token);
    const cacheKey = `${CACHE_KEYS.AUTH_USER_PREFIX}${decoded.id}`;

    let authUser = memoryCache.get<CachedAuthUser>(cacheKey);
    if (!authUser) {
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { id: true, role: true, branchId: true },
      });
      if (!user) {
        return res.status(401).json({ success: false, status: 'error', message: 'Unauthorized, invalid token' });
      }
      authUser = {
        id: user.id,
        role: user.role,
        branchId: user.branchId?.trim() || decoded.branchId || PRIMARY_BRANCH_ID,
      };
      memoryCache.set(cacheKey, authUser, AUTH_CACHE_TTL_SECONDS);
    }

    req.user = authUser;
    req.tenant = resolveTenantScope({
      userRole: authUser.role,
      userBranchId: authUser.branchId,
      requestedBranchId: extractRequestedBranchParam(req),
    });

    next();
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return res.status(err.statusCode).json({
        success: false,
        status: 'error',
        code: err.code ?? 'CROSS_BRANCH_FORBIDDEN',
        message: err.message,
      });
    }
    res.status(401).json({ success: false, status: 'error', message: 'Unauthorized, invalid token' });
  }
};

export const requireRole = (roles: readonly string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roleHasPermission(req.user.role, roles)) {
      return res.status(403).json({
        success: false,
        status: 'error',
        message: 'Forbidden, insufficient permissions',
      });
    }
    next();
  };
};

// Backwards-compatible aliases
export const authenticate = requireAuth;
export const authorize = (...roles: string[]) => requireRole(roles);
