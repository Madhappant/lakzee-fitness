import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { prisma } from '../app';
import { CACHE_KEYS, memoryCache } from '../utils/cache';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    role: string;
  };
}

interface CachedAuthUser {
  id: string;
  role: string;
}

const AUTH_CACHE_TTL_SECONDS = 5;

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized, no token' });
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized, no token' });
    }

    const decoded = verifyToken(token);
    const cacheKey = `${CACHE_KEYS.AUTH_USER_PREFIX}${decoded.id}`;

    let authUser = memoryCache.get<CachedAuthUser>(cacheKey);
    if (!authUser) {
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { id: true, role: true },
      });
      if (!user) {
        return res.status(401).json({ status: 'error', message: 'Unauthorized, invalid token' });
      }
      authUser = { id: user.id, role: user.role };
      memoryCache.set(cacheKey, authUser, AUTH_CACHE_TTL_SECONDS);
    }

    req.user = authUser;
    next();
  } catch {
    res.status(401).json({ status: 'error', message: 'Unauthorized, invalid token' });
  }
};

export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ status: 'error', message: 'Forbidden, insufficient permissions' });
    }
    next();
  };
};
