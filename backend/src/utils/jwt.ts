import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { securityEnv } from '../config/env';
import { PRIMARY_BRANCH_ID } from './tenant';

export interface AccessTokenPayload {
  id: string;
  role: string;
  branchId: string;
  tokenType: 'access';
}

export interface RefreshTokenPayload {
  id: string;
  role: string;
  branchId: string;
  jti: string;
  familyId: string;
  tokenType: 'refresh';
}

export interface TokenUserInput {
  id: string;
  role: string;
  branchId?: string | null;
}

export const generateAccessToken = (user: TokenUserInput): string => {
  const options: jwt.SignOptions = {
    expiresIn: securityEnv.jwtAccessExpiresIn as jwt.SignOptions['expiresIn'],
  };
  return jwt.sign(
    {
      id: user.id,
      role: user.role,
      branchId: user.branchId?.trim() || PRIMARY_BRANCH_ID,
      tokenType: 'access',
    } satisfies AccessTokenPayload,
    securityEnv.jwtAccessSecret,
    options
  );
};

export const verifyAccessToken = (token: string): AccessTokenPayload => {
  const decoded = jwt.verify(token, securityEnv.jwtAccessSecret) as AccessTokenPayload;
  if (!decoded || decoded.tokenType !== 'access' || !decoded.id || !decoded.role) {
    throw new Error('Invalid access token payload');
  }
  return {
    ...decoded,
    branchId: decoded.branchId?.trim() || PRIMARY_BRANCH_ID,
  };
};

export const generateRefreshToken = (
  user: TokenUserInput,
  jti: string,
  familyId: string
): string => {
  const options: jwt.SignOptions = {
    expiresIn: securityEnv.jwtRefreshExpiresIn as jwt.SignOptions['expiresIn'],
  };
  return jwt.sign(
    {
      id: user.id,
      role: user.role,
      branchId: user.branchId?.trim() || PRIMARY_BRANCH_ID,
      jti,
      familyId,
      tokenType: 'refresh',
    } satisfies RefreshTokenPayload,
    securityEnv.jwtRefreshSecret,
    options
  );
};

export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  const decoded = jwt.verify(token, securityEnv.jwtRefreshSecret) as RefreshTokenPayload;
  if (
    !decoded ||
    decoded.tokenType !== 'refresh' ||
    !decoded.id ||
    !decoded.role ||
    !decoded.jti ||
    !decoded.familyId
  ) {
    throw new Error('Invalid refresh token payload');
  }
  return {
    ...decoded,
    branchId: decoded.branchId?.trim() || PRIMARY_BRANCH_ID,
  };
};

export const hashRefreshToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

// Backwards-compatible aliases used by existing tests & modules
export const generateToken = generateAccessToken;
export const verifyToken = verifyAccessToken;
