import { Response } from 'express';
import { prisma } from '../app';
import { AuthRequest } from '../middlewares/auth.middleware';
import { asyncHandler } from '../middlewares/error.middleware';
import { BadRequestError, NotFoundError, UnauthorizedError } from '../utils/errors';

export const getMyProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Unauthorized');

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const memberProfile = await prisma.memberProfile.findUnique({
    where: { userId },
    include: {
      user: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
      trainer: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
      subscriptions: {
        where: {
          status: 'ACTIVE',
          endDate: { gte: startOfToday },
        },
        include: {
          plan: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!memberProfile) {
    throw new NotFoundError('Member profile not found');
  }

  res.json({ status: 'success', data: memberProfile });
});

export const getMyAttendance = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Unauthorized');

  const memberProfile = await prisma.memberProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!memberProfile) throw new NotFoundError('Member not found');

  const attendance = await prisma.attendance.findMany({
    where: { memberId: memberProfile.id },
    orderBy: { checkIn: 'desc' },
    take: 30,
  });

  res.json({ status: 'success', data: attendance });
});

export const getMySubscriptions = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Unauthorized');

  const memberProfile = await prisma.memberProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!memberProfile) throw new NotFoundError('Member not found');

  const subscriptions = await prisma.subscription.findMany({
    where: { memberId: memberProfile.id },
    orderBy: { createdAt: 'desc' },
    include: {
      plan: true,
      invoice: {
        select: {
          id: true,
          invoiceNumber: true,
          totalAmount: true,
          status: true,
        },
      },
    },
  });

  res.json({ status: 'success', data: subscriptions });
});

export const uploadPhoto = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Unauthorized');
  if (!req.file) throw new BadRequestError('No file uploaded');

  const memberProfile = await prisma.memberProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!memberProfile) throw new NotFoundError('Member not found');

  let photoUrl = `/uploads/${req.file.filename}`;
  if ((process.env.CLOUDINARY_URL || process.env.CLOUDINARY_CLOUD_NAME) && req.file.path) {
    photoUrl = req.file.path;
  }

  const updatedProfile = await prisma.memberProfile.update({
    where: { userId },
    data: { photoUrl },
    select: { photoUrl: true },
  });

  res.json({ status: 'success', data: { photoUrl: updatedProfile.photoUrl } });
});

export const getMyDietPlan = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Unauthorized');

  const memberProfile = await prisma.memberProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!memberProfile) throw new NotFoundError('Member not found');

  const activeDietPlan = await prisma.dietPlan.findFirst({
    where: { memberId: memberProfile.id, isActive: true },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ status: 'success', data: activeDietPlan });
});

export const getMyWorkoutRoutine = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Unauthorized');

  const memberProfile = await prisma.memberProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!memberProfile) throw new NotFoundError('Member not found');

  const activeRoutine = await prisma.workoutRoutine.findFirst({
    where: { memberId: memberProfile.id, isActive: true },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ status: 'success', data: activeRoutine });
});
