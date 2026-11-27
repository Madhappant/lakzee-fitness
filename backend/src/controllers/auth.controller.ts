import { Request, Response } from 'express';
import { prisma } from '../app';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { generateToken } from '../utils/jwt';
import { AuthRequest } from '../middlewares/auth.middleware';
import { asyncHandler } from '../middlewares/error.middleware';
import { BadRequestError, ForbiddenError, NotFoundError, UnauthorizedError } from '../utils/errors';
import { invalidateCacheScopes } from '../utils/cache';
import { z } from 'zod';

const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(6),
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string(),
});

const requestOtpSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

const resetSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  otp: z.string().length(6),
  newPassword: z.string().min(6),
});

const requestPhoneOtpSchema = z.object({
  email: z.string().trim().toLowerCase().email().optional(),
  newPhone: z.string().trim().min(5),
});

const verifyPhoneSchema = z.object({
  email: z.string().trim().toLowerCase().email().optional(),
  otp: z.string().length(6),
});

const EMAIL_WEBHOOK_TIMEOUT_MS = 12000;
const generateSecureOtp = () => crypto.randomInt(100000, 1000000).toString();

async function sendOtpEmailViaScript(to: string, subject: string, html: string) {
  const scriptUrl = process.env.GOOGLE_SCRIPT_URL;
  if (!scriptUrl) {
    throw new Error('Server configuration error: GOOGLE_SCRIPT_URL is missing. Please add it to your Render environment variables.');
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
      throw new Error(data.error);
    }
  } finally {
    clearTimeout(timer);
  }
}

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { email, password, firstName, lastName } = registerSchema.parse(req.body);

  const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existingUser) {
    throw new BadRequestError('Email already exists');
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const user = await prisma.user.create({
    data: { email, password: hashedPassword, firstName, lastName },
  });

  const token = generateToken(user);

  res.status(201).json({
    status: 'success',
    data: {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      token,
    },
  });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = loginSchema.parse(req.body);

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      password: true,
      role: true,
      firstName: true,
      lastName: true,
    },
  });

  if (!user) {
    throw new UnauthorizedError('Invalid credentials');
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new UnauthorizedError('Invalid credentials');
  }

  const token = generateToken(user);

  res.status(200).json({
    status: 'success',
    data: {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      token,
    },
  });
});

export const requestOtp = asyncHandler(async (req: Request, res: Response) => {
  const { email } = requestOtpSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) {
    return res.status(200).json({ status: 'success', message: 'If the email exists, an OTP has been sent.' });
  }

  const otp = generateSecureOtp();
  const expiry = new Date(Date.now() + 10 * 60 * 1000);

  await prisma.user.update({
    where: { email },
    data: { resetOtp: otp, resetOtpExpiry: expiry },
  });

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

  try {
    await sendOtpEmailViaScript(email, 'Your Password Reset OTP', resetHtml);
  } catch (mailError) {
    const msg = mailError instanceof Error ? mailError.message : String(mailError);
    return res.status(500).json({
      status: 'error',
      message: msg.includes('GOOGLE_SCRIPT_URL') ? msg : `Failed to send email: ${msg}`,
    });
  }

  res.status(200).json({
    status: 'success',
    message: 'OTP has been sent to your registered email address.',
    phoneMasked: email,
  });
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { email, otp, newPassword } = resetSchema.parse(req.body);

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, resetOtp: true, resetOtpExpiry: true },
  });

  if (!user || user.resetOtp !== otp) {
    throw new BadRequestError('Invalid OTP or email');
  }
  if (!user.resetOtpExpiry || user.resetOtpExpiry < new Date()) {
    throw new BadRequestError('OTP has expired');
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(newPassword, salt);

  await prisma.user.update({
    where: { email },
    data: { password: hashedPassword, resetOtp: null, resetOtpExpiry: null },
  });

  invalidateCacheScopes(`auth:${user.id}`);

  res.status(200).json({
    status: 'success',
    message: 'Password reset successfully',
  });
});

export const requestPhoneOtp = asyncHandler(async (req: AuthRequest, res: Response) => {
  const authUserId = req.user?.id;
  if (!authUserId) {
    throw new UnauthorizedError('Unauthorized');
  }

  const { email, newPhone } = requestPhoneOtpSchema.parse(req.body);

  const user = await prisma.user.findUnique({
    where: { id: authUserId },
    select: { id: true, email: true },
  });
  if (!user) {
    throw new NotFoundError('User not found');
  }

  if (email && email !== user.email.toLowerCase()) {
    throw new ForbiddenError('Forbidden: You can only update your own phone number');
  }

  const otp = generateSecureOtp();
  const expiry = new Date(Date.now() + 10 * 60 * 1000);

  await prisma.user.update({
    where: { id: user.id },
    data: { pendingPhone: newPhone, phoneOtp: otp, phoneOtpExpiry: expiry },
  });

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

  try {
    await sendOtpEmailViaScript(user.email, 'Verify Your New Phone Number', phoneHtml);
  } catch (mailError) {
    const msg = mailError instanceof Error ? mailError.message : String(mailError);
    return res.status(500).json({
      status: 'error',
      message: msg.includes('GOOGLE_SCRIPT_URL') ? msg : `Failed to send email: ${msg}`,
    });
  }

  res.status(200).json({
    status: 'success',
    message: 'OTP has been sent to your registered email address.',
    phoneMasked: user.email,
  });
});

export const verifyPhoneOtp = asyncHandler(async (req: AuthRequest, res: Response) => {
  const authUserId = req.user?.id;
  if (!authUserId) {
    throw new UnauthorizedError('Unauthorized');
  }

  const { email, otp } = verifyPhoneSchema.parse(req.body);

  const user = await prisma.user.findUnique({
    where: { id: authUserId },
    select: {
      id: true,
      email: true,
      phoneOtp: true,
      phoneOtpExpiry: true,
      pendingPhone: true,
    },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  if (email && email !== user.email.toLowerCase()) {
    throw new ForbiddenError('Forbidden: You can only verify your own phone number');
  }
  if (!user.phoneOtp || user.phoneOtp !== otp) {
    throw new BadRequestError('Invalid OTP');
  }
  if (!user.phoneOtpExpiry || user.phoneOtpExpiry < new Date()) {
    throw new BadRequestError('OTP has expired');
  }
  if (!user.pendingPhone) {
    throw new BadRequestError('No pending phone number to update');
  }

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      phone: user.pendingPhone,
      pendingPhone: null,
      phoneOtp: null,
      phoneOtpExpiry: null,
    },
    select: {
      id: true,
      email: true,
      role: true,
      firstName: true,
      lastName: true,
      phone: true,
    },
  });

  invalidateCacheScopes('members', 'dashboard');

  res.status(200).json({
    status: 'success',
    message: 'Phone number updated successfully',
    data: { user: updatedUser },
  });
});
