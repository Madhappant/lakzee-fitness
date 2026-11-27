import { Response } from 'express';
import { prisma } from '../app';
import { AuthRequest } from '../middlewares/auth.middleware';
import { asyncHandler } from '../middlewares/error.middleware';
import { ForbiddenError, NotFoundError } from '../utils/errors';
import { z } from 'zod';

const dietPlanSchema = z.object({
  title: z.string().trim().min(1).max(150).optional(),
  notes: z.string().max(2000).optional(),
  mealsData: z.union([z.record(z.string(), z.string()), z.string()]),
});

const workoutRoutineSchema = z.object({
  title: z.string().trim().min(1).max(150).optional(),
  notes: z.string().max(2000).optional(),
  exercisesData: z.union([z.record(z.string(), z.string()), z.string()]),
});

export const assignDietPlan = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.params.memberId as string;
  const { title, notes, mealsData } = dietPlanSchema.parse(req.body);
  const assignedBy = req.user?.id;

  const profile = await prisma.memberProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!profile) {
    throw new NotFoundError('Member profile not found');
  }

  const serializedMeals = typeof mealsData === 'string' ? mealsData : JSON.stringify(mealsData);

  const newDietPlan = await prisma.$transaction(async (tx) => {
    await tx.dietPlan.updateMany({
      where: { memberId: profile.id, isActive: true },
      data: { isActive: false },
    });

    return tx.dietPlan.create({
      data: {
        memberId: profile.id,
        title: title || 'Personalized Diet Plan',
        notes,
        mealsData: serializedMeals,
        assignedBy,
      },
    });
  });

  res.status(201).json({ status: 'success', data: newDietPlan });
});

export const getMemberDietPlan = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.params.memberId as string;

  if (req.user?.role === 'MEMBER' && req.user.id !== userId) {
    throw new ForbiddenError('Forbidden: You can only view your own diet plan');
  }

  const profile = await prisma.memberProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!profile) {
    throw new NotFoundError('Member profile not found');
  }

  const activeDietPlan = await prisma.dietPlan.findFirst({
    where: { memberId: profile.id, isActive: true },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ status: 'success', data: activeDietPlan });
});

export const assignWorkoutRoutine = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.params.memberId as string;
  const { title, notes, exercisesData } = workoutRoutineSchema.parse(req.body);
  const assignedBy = req.user?.id;

  const profile = await prisma.memberProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!profile) {
    throw new NotFoundError('Member profile not found');
  }

  const serializedExercises = typeof exercisesData === 'string' ? exercisesData : JSON.stringify(exercisesData);

  const newRoutine = await prisma.$transaction(async (tx) => {
    await tx.workoutRoutine.updateMany({
      where: { memberId: profile.id, isActive: true },
      data: { isActive: false },
    });

    return tx.workoutRoutine.create({
      data: {
        memberId: profile.id,
        title: title || 'Personalized Workout Routine',
        notes,
        exercisesData: serializedExercises,
        assignedBy,
      },
    });
  });

  res.status(201).json({ status: 'success', data: newRoutine });
});

export const getMemberWorkoutRoutine = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.params.memberId as string;

  if (req.user?.role === 'MEMBER' && req.user.id !== userId) {
    throw new ForbiddenError('Forbidden: You can only view your own workout routine');
  }

  const profile = await prisma.memberProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!profile) {
    throw new NotFoundError('Member profile not found');
  }

  const activeRoutine = await prisma.workoutRoutine.findFirst({
    where: { memberId: profile.id, isActive: true },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ status: 'success', data: activeRoutine });
});
