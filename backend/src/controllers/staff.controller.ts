import { Request, Response } from 'express';
import { prisma } from '../app';
import { AuthRequest } from '../middlewares/auth.middleware';
import { asyncHandler } from '../middlewares/error.middleware';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { invalidateCacheScopes } from '../utils/cache';
import { z } from 'zod';

const assignRoleSchema = z.object({
  userId: z.string().trim().min(1),
  role: z.enum(['ADMIN', 'RECEPTIONIST', 'TRAINER']),
});

export const getStaff = asyncHandler(async (_req: Request, res: Response) => {
  const users = await prisma.user.findMany({
    where: {
      role: { in: ['ADMIN', 'RECEPTIONIST', 'TRAINER'] },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      createdAt: true,
      updatedAt: true,
      roleAssignedAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ status: 'success', data: users });
});

export const assignRole = asyncHandler(async (req: Request, res: Response) => {
  const validatedData = assignRoleSchema.parse(req.body);
  let { userId } = validatedData;
  const { role } = validatedData;

  if (userId.startsWith('LZ-')) {
    const profile = await prisma.memberProfile.findUnique({
      where: { memberId: userId },
      select: { userId: true },
    });
    if (!profile) {
      throw new NotFoundError('Lakzee ID not found');
    }
    userId = profile.userId;
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) {
    throw new NotFoundError('User UUID not found');
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { role, roleAssignedAt: new Date() },
    omit: { password: true },
  });

  invalidateCacheScopes(`auth:${userId}`, 'dashboard');

  res.json({ status: 'success', message: 'Role assigned successfully', data: updated });
});

export const revokeRole = asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;

  if (req.user?.id === id) {
    throw new BadRequestError('Cannot revoke your own admin role');
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { role: 'MEMBER' },
    omit: { password: true },
  });

  invalidateCacheScopes(`auth:${id}`, 'dashboard');

  res.json({ status: 'success', message: 'Role revoked', data: updated });
});
