import { Request, Response, NextFunction } from 'express';
import { prisma } from '../app';
import { z } from 'zod';

const assignRoleSchema = z.object({
  userId: z.string(),
  role: z.enum(['ADMIN', 'RECEPTIONIST', 'TRAINER'])
});

export const getStaff = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await prisma.user.findMany({
      where: {
        role: { in: ['ADMIN', 'RECEPTIONIST', 'TRAINER'] }
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ status: 'success', data: users });
  } catch (error) {
    next(error);
  }
};

export const assignRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validatedData = assignRoleSchema.parse(req.body);
    let { userId, role } = validatedData;
    
    // Support lookup by Lakzee ID (e.g., LZ-1234) as well as UUID
    if (userId.startsWith('LZ-')) {
      const profile = await prisma.memberProfile.findUnique({ where: { memberId: userId } });
      if (!profile) {
        return res.status(404).json({ status: 'error', message: 'Lakzee ID not found' });
      }
      userId = profile.userId;
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ status: 'error', message: 'User UUID not found' });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { role: role }
    });

    res.json({ status: 'success', message: 'Role assigned successfully', data: updated });
  } catch (error) {
    next(error);
  }
};

export const revokeRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    
    // Prevent self-revocation for safety
    if ((req as any).user?.id === id) {
      return res.status(400).json({ status: 'error', message: 'Cannot revoke your own admin role' });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { role: 'MEMBER' }
    });

    res.json({ status: 'success', message: 'Role revoked', data: updated });
  } catch (error) {
    next(error);
  }
};
