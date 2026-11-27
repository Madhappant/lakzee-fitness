/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { prisma } from '../app';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { asyncHandler } from '../middlewares/error.middleware';
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors';
import { CACHE_KEYS, invalidateCacheScopes, memoryCache } from '../utils/cache';
import {
  createMemberRecord,
  deleteMemberCascade,
  parseMemberSortOrder,
  sortMembers,
} from '../services/member.service';

const createMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(6),
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  phone: z.string().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  dob: z.string().optional(),
  bloodGroup: z.string().optional(),
  address: z.string().optional(),
  emergencyContact: z.string().optional(),
});

const updateMemberSchema = z.object({
  memberId: z.string().trim().min(1).optional(),
  firstName: z.string().trim().min(1).optional(),
  lastName: z.string().trim().min(1).optional(),
  phone: z.string().optional(),
  email: z.string().trim().toLowerCase().email().optional(),
  password: z.string().min(6).optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  dob: z.string().optional(),
  bloodGroup: z.string().optional(),
  address: z.string().optional(),
  emergencyContact: z.string().optional(),
});

const parseOptionalDate = (val?: string): Date | null | undefined => {
  if (val === undefined) return undefined;
  const trimmed = val.trim();
  if (!trimmed) return null;
  const d = new Date(trimmed);
  if (isNaN(d.getTime())) {
    throw new BadRequestError('Invalid date of birth');
  }
  return d;
};

function resolveUploadedPhotoUrl(file?: Express.Multer.File): string | undefined {
  if (!file) return undefined;
  if ((process.env.CLOUDINARY_URL || process.env.CLOUDINARY_CLOUD_NAME) && file.path.startsWith('http')) {
    return file.path;
  }
  return `/uploads/${file.filename}`;
}

export const createMember = asyncHandler(async (req: Request, res: Response) => {
  const validatedData = createMemberSchema.parse(req.body);
  const { dob, ...rest } = validatedData;
  const parsedDob = parseOptionalDate(dob);

  const newMember = await createMemberRecord(prisma, {
    ...rest,
    dob: parsedDob,
    photoUrl: resolveUploadedPhotoUrl(req.file),
  });

  res.status(201).json({ status: 'success', data: newMember });
});

export const getMembers = asyncHandler(async (req: Request, res: Response) => {
  const sortOrder = parseMemberSortOrder(req.query.sort);
  const cacheKey = `${CACHE_KEYS.MEMBERS_LIST}:${sortOrder}`;

  const cached = memoryCache.get<unknown[]>(cacheKey);
  if (cached) {
    return res.json({ status: 'success', data: cached });
  }

  const members = await prisma.user.findMany({
    where: { role: 'MEMBER' },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      role: true,
      createdAt: true,
      memberProfile: {
        select: {
          id: true,
          memberId: true,
          photoUrl: true,
          gender: true,
          bloodGroup: true,
          joiningDate: true,
          qrCode: true,
          subscriptions: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            select: {
              status: true,
              plan: { select: { id: true, name: true, price: true } },
            },
          },
        },
      },
    },
    orderBy:
      sortOrder === 'latest'
        ? { createdAt: 'desc' }
        : { memberProfile: { memberId: sortOrder === 'desc' ? 'desc' : 'asc' } },
  });

  const sortedMembers = sortMembers(members, sortOrder);
  memoryCache.set(cacheKey, sortedMembers, 30);
  res.json({ status: 'success', data: sortedMembers });
});

export const getMemberById = asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;

  if (req.user?.role === 'MEMBER' && req.user.id !== id) {
    throw new ForbiddenError('Forbidden: You can only view your own profile');
  }

  const member = await prisma.user.findUnique({
    where: { id },
    include: { memberProfile: true, assignedMembers: true },
    omit: { password: true, resetOtp: true, resetOtpExpiry: true, phoneOtp: true, phoneOtpExpiry: true },
  });

  if (!member) {
    throw new NotFoundError('Member not found');
  }

  res.json({ status: 'success', data: member });
});

export const deleteMember = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  await deleteMemberCascade(prisma, id);
  res.json({ status: 'success', message: 'Member deleted successfully' });
});

export const updateMember = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const validatedData = updateMemberSchema.parse(req.body);
  const { firstName, lastName, phone, email, password, memberId, ...profileData } = validatedData;

  const existingUser = await prisma.user.findUnique({
    where: { id },
    select: { id: true, memberProfile: { select: { id: true } } },
  });

  if (!existingUser) {
    throw new NotFoundError('Member not found');
  }

  const parsedDob = parseOptionalDate(profileData.dob);

  const [existingEmail, existingProfile] = await Promise.all([
    email ? prisma.user.findUnique({ where: { email }, select: { id: true } }) : Promise.resolve(null),
    memberId
      ? prisma.memberProfile.findUnique({
          where: { memberId: memberId.trim() },
          select: { userId: true },
        })
      : Promise.resolve(null),
  ]);

  if (existingEmail && existingEmail.id !== id) {
    throw new BadRequestError('Email already exists');
  }

  if (existingProfile && existingProfile.userId !== id) {
    throw new BadRequestError('Member No. already exists. Please choose a unique Member No.');
  }

  const profileUpdateFields: any = {
    ...profileData,
    ...(memberId ? { memberId: memberId.trim() } : {}),
  };
  if (parsedDob !== undefined) {
    profileUpdateFields.dob = parsedDob;
  }

  const photoUrl = resolveUploadedPhotoUrl(req.file);
  if (photoUrl) {
    profileUpdateFields.photoUrl = photoUrl;
  }

  const updateData: any = {
    firstName,
    lastName,
    phone,
  };

  if (existingUser.memberProfile) {
    updateData.memberProfile = { update: profileUpdateFields };
  } else if (memberId || Object.keys(profileUpdateFields).length > 0) {
    updateData.memberProfile = {
      create: {
        memberId: memberId ? memberId.trim() : `LZ-${Date.now().toString().slice(-6)}`,
        ...profileUpdateFields,
      },
    };
  }

  if (email) updateData.email = email;
  if (password) updateData.password = await bcrypt.hash(password, 10);

  const updatedMember = await prisma.user.update({
    where: { id },
    data: updateData,
    include: { memberProfile: true },
    omit: { password: true, resetOtp: true, resetOtpExpiry: true, phoneOtp: true, phoneOtpExpiry: true },
  });

  invalidateCacheScopes('dashboard', 'reports', 'members', `auth:${id}`);

  res.json({ status: 'success', data: updatedMember });
});
