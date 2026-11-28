import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { securityEnv } from '../config/env';
import { AuthStaffRepository, authStaffRepository } from '../repositories/auth-staff.repository';
import { invalidateCacheScopes } from '../utils/cache';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  UpstreamError,
} from '../utils/errors';
import {
  generateAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  verifyRefreshToken,
} from '../utils/jwt';
import { PRIMARY_BRANCH_ID } from '../utils/tenant';

const EMAIL_WEBHOOK_TIMEOUT_MS = 12000;
const generateSecureOtp = () => crypto.randomInt(100000, 1000000).toString();

export interface SessionClientMeta {
  userAgent?: string;
  ipAddress?: string;
}

async function sendOtpEmailViaScript(to: string, subject: string, html: string) {
  const scriptUrl = process.env.GOOGLE_SCRIPT_URL;
  if (!scriptUrl) {
    throw new UpstreamError(
      'Server configuration error: GOOGLE_SCRIPT_URL is missing. Please add it to your Render environment variables.',
      500
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), EMAIL_WEBHOOK_TIMEOUT_MS);

  try {
    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: process.env.GOOGLE_SCRIPT_SECRET,
        to,
        subject,
        html,
      }),
      signal: controller.signal,
    });

    const data = (await response.json()) as { error?: string };
    if (data.error) {
      throw new UpstreamError(`Failed to send email: ${data.error}`, 502);
    }
  } catch (err) {
    if (err instanceof UpstreamError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    throw new UpstreamError(
      msg.includes('GOOGLE_SCRIPT_URL') ? msg : `Failed to send email: ${msg}`,
      500
    );
  } finally {
    clearTimeout(timer);
  }
}

export class AuthService {
  constructor(private readonly repo: AuthStaffRepository = authStaffRepository) {}

  private async issueSessionTokens(
    user: { id: string; role: string; branchId?: string | null },
    meta?: SessionClientMeta
  ) {
    const branchId = user.branchId?.trim() || PRIMARY_BRANCH_ID;
    const jti = crypto.randomUUID();
    const familyId = crypto.randomUUID();
    const accessToken = generateAccessToken({ id: user.id, role: user.role, branchId });
    const refreshToken = generateRefreshToken({ id: user.id, role: user.role, branchId }, jti, familyId);

    await this.repo.createRefreshSession({
      id: jti,
      familyId,
      userId: user.id,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: new Date(Date.now() + securityEnv.refreshCookieMaxAgeMs),
      userAgent: meta?.userAgent,
      ipAddress: meta?.ipAddress,
    });

    return { accessToken, refreshToken };
  }

  async register(
    input: { email: string; password: string; firstName: string; lastName: string; branchId?: string },
    meta?: SessionClientMeta
  ) {
    const existing = await this.repo.findUserByEmail(input.email);
    if (existing) {
      throw new BadRequestError('Email already exists');
    }

    const salt = await bcrypt.genSalt(securityEnv.bcryptCostFactor);
    const hashedPassword = await bcrypt.hash(input.password, salt);

    const user = await this.repo.createRegisteredUser({
      email: input.email,
      password: hashedPassword,
      firstName: input.firstName,
      lastName: input.lastName,
      branchId: input.branchId || PRIMARY_BRANCH_ID,
    });

    const { accessToken, refreshToken } = await this.issueSessionTokens(user, meta);
    return {
      user: { ...user, branchId: user.branchId || PRIMARY_BRANCH_ID },
      token: accessToken,
      accessToken,
      refreshToken,
    };
  }

  async login(input: { email: string; password: string }, meta?: SessionClientMeta) {
    const user = await this.repo.findUserForLogin(input.email);
    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(input.password, user.password);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const branchId = user.branchId?.trim() || PRIMARY_BRANCH_ID;
    const { accessToken, refreshToken } = await this.issueSessionTokens({ ...user, branchId }, meta);
    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        branchId,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      token: accessToken,
      accessToken,
      refreshToken,
    };
  }

  async refreshSession(rawRefreshToken: string | undefined, meta?: SessionClientMeta) {
    if (!rawRefreshToken) {
      throw new UnauthorizedError('Refresh token missing');
    }

    let decoded;
    try {
      decoded = verifyRefreshToken(rawRefreshToken);
    } catch {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    const tokenHash = hashRefreshToken(rawRefreshToken);
    const storedSession = await this.repo.findRefreshSessionByHash(tokenHash);
    if (!storedSession) {
      throw new UnauthorizedError('Refresh session not recognized');
    }

    // Theft / replay protection: reuse of a rotated token revokes the entire token family
    if (storedSession.revokedAt) {
      await this.repo.revokeRefreshFamily(storedSession.familyId);
      invalidateCacheScopes(`auth:${storedSession.userId}`);
      throw new UnauthorizedError('Refresh token reuse detected. Please log in again.');
    }

    if (storedSession.expiresAt < new Date()) {
      await this.repo.revokeRefreshSessionByHash(tokenHash);
      throw new UnauthorizedError('Refresh token has expired');
    }

    const user = await this.repo.findUserForSession(decoded.id);
    if (!user) {
      await this.repo.revokeRefreshFamily(storedSession.familyId);
      throw new UnauthorizedError('User account no longer exists');
    }

    const branchId = user.branchId?.trim() || PRIMARY_BRANCH_ID;
    const nextJti = crypto.randomUUID();
    const nextRefreshToken = generateRefreshToken({ ...user, branchId }, nextJti, storedSession.familyId);
    const nextAccessToken = generateAccessToken({ ...user, branchId });

    await this.repo.rotateRefreshSession(storedSession.id, {
      id: nextJti,
      familyId: storedSession.familyId,
      userId: user.id,
      tokenHash: hashRefreshToken(nextRefreshToken),
      expiresAt: new Date(Date.now() + securityEnv.refreshCookieMaxAgeMs),
      userAgent: meta?.userAgent,
      ipAddress: meta?.ipAddress,
    });

    invalidateCacheScopes(`auth:${user.id}`);

    return {
      user: { ...user, branchId },
      token: nextAccessToken,
      accessToken: nextAccessToken,
      refreshToken: nextRefreshToken,
    };
  }

  async logoutSession(rawRefreshToken?: string, authenticatedUserId?: string) {
    if (rawRefreshToken) {
      await this.repo.revokeRefreshSessionByHash(hashRefreshToken(rawRefreshToken));
    }
    if (authenticatedUserId) {
      invalidateCacheScopes(`auth:${authenticatedUserId}`);
    }
  }

  async requestPasswordOtp(email: string) {
    const user = await this.repo.findUserByEmail(email);
    if (!user) {
      return { sent: false, message: 'If the email exists, an OTP has been sent.' };
    }

    const otp = generateSecureOtp();
    const expiry = new Date(Date.now() + 10 * 60 * 1000);
    await this.repo.setResetOtp(email, otp, expiry);

    const resetHtml = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px; background-color: #fafafa;">
  <h2 style="color: #333333; text-align: center;">Your Password Reset Request</h2>
  <p style="color: #555555; line-height: 1.6; font-size: 16px;">
    Hello,<br><br>
    Use the One-Time Password (OTP) below to reset your Lakzee Fitness password. It expires in 10 minutes.
  </p>
  <div style="text-align: center; margin: 30px 0;">
    <span style="display: inline-block; padding: 15px 30px; font-size: 28px; font-weight: bold; color: #0A0A0C; background-color: #D4FF00; border-radius: 8px; letter-spacing: 5px;">
      ${otp}
    </span>
  </div>
  <p style="color: #888888; font-size: 12px; text-align: center; line-height: 1.5;">
    &copy; ${new Date().getFullYear()} Lakzee Fitness Studio. All rights reserved.
  </p>
</div>`;

    await sendOtpEmailViaScript(email, 'Your Password Reset OTP', resetHtml);
    return {
      sent: true,
      message: 'OTP has been sent to your registered email address.',
      phoneMasked: email,
    };
  }

  async resetPassword(input: { email: string; otp: string; newPassword: string }) {
    const user = await this.repo.findUserForReset(input.email);
    if (!user || user.resetOtp !== input.otp) {
      throw new BadRequestError('Invalid OTP or email');
    }
    if (!user.resetOtpExpiry || user.resetOtpExpiry < new Date()) {
      throw new BadRequestError('OTP has expired');
    }

    const salt = await bcrypt.genSalt(securityEnv.bcryptCostFactor);
    const hashedPassword = await bcrypt.hash(input.newPassword, salt);
    await this.repo.completePasswordReset(input.email, hashedPassword);

    invalidateCacheScopes(`auth:${user.id}`);
  }

  async requestPhoneOtp(authUserId: string | undefined, input: { email?: string; newPhone: string }) {
    if (!authUserId) throw new UnauthorizedError('Unauthorized');

    const user = await this.repo.findUserEmailById(authUserId);
    if (!user) throw new NotFoundError('User not found');

    if (input.email && emailMismatch(input.email, user.email)) {
      throw new ForbiddenError('Forbidden: You can only update your own phone number');
    }

    const otp = generateSecureOtp();
    const expiry = new Date(Date.now() + 10 * 60 * 1000);
    await this.repo.setPhoneVerificationOtp(user.id, input.newPhone, otp, expiry);

    const phoneHtml = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px; background-color: #fafafa;">
  <h2 style="color: #333333; text-align: center;">Phone Verification Request</h2>
  <p style="color: #555555; line-height: 1.6; font-size: 16px;">
    Use the One-Time Password (OTP) below to verify your new phone number. It expires in 10 minutes.
  </p>
  <div style="text-align: center; margin: 30px 0;">
    <span style="display: inline-block; padding: 15px 30px; font-size: 28px; font-weight: bold; color: #0A0A0C; background-color: #D4FF00; border-radius: 8px; letter-spacing: 5px;">
      ${otp}
    </span>
  </div>
</div>`;

    await sendOtpEmailViaScript(user.email, 'Verify Your New Phone Number', phoneHtml);
    return {
      message: 'OTP has been sent to your registered email address.',
      phoneMasked: user.email,
    };
  }

  async verifyPhoneOtp(authUserId: string | undefined, input: { email?: string; otp: string }) {
    if (!authUserId) throw new UnauthorizedError('Unauthorized');

    const user = await this.repo.findUserForPhoneVerification(authUserId);
    if (!user) throw new NotFoundError('User not found');

    if (input.email && emailMismatch(input.email, user.email)) {
      throw new ForbiddenError('Forbidden: You can only verify your own phone number');
    }
    if (!user.phoneOtp || user.phoneOtp !== input.otp) {
      throw new BadRequestError('Invalid OTP');
    }
    if (!user.phoneOtpExpiry || user.phoneOtpExpiry < new Date()) {
      throw new BadRequestError('OTP has expired');
    }
    if (!user.pendingPhone) {
      throw new BadRequestError('No pending phone number to update');
    }

    const updatedUser = await this.repo.completePhoneVerification(user.id, user.pendingPhone);
    invalidateCacheScopes('members', 'dashboard');
    return updatedUser;
  }
}

function emailMismatch(provided: string, actual: string): boolean {
  return provided.trim().toLowerCase() !== actual.trim().toLowerCase();
}

export const authService = new AuthService();
