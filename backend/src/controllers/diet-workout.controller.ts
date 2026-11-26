import { Response } from 'express';
import { prisma } from '../app';
import { AuthRequest } from '../middlewares/auth.middleware';
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

export const assignDietPlan = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.params.memberId as string;
    const { title, notes, mealsData } = dietPlanSchema.parse(req.body);
    const assignedBy = req.user?.id;

    const profile = await prisma.memberProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ status: 'error', message: 'Member profile not found' });
    const memberProfileId = profile.id;

    const serializedMeals = typeof mealsData === 'string' ? mealsData : JSON.stringify(mealsData);

    const newDietPlan = await prisma.$transaction(async (tx) => {
      await tx.dietPlan.updateMany({
        where: { memberId: memberProfileId, isActive: true },
        data: { isActive: false },
      });

      return tx.dietPlan.create({
        data: {
          memberId: memberProfileId,
          title: title || 'Personalized Diet Plan',
          notes,
          mealsData: serializedMeals,
          assignedBy,
        },
      });
    });

    res.status(201).json({ status: 'success', data: newDietPlan });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ status: 'error', message: 'Validation failed', errors: (error as any).errors });
    }
    console.error(error);
    res.status(500).json({ status: 'error', message: 'Failed to assign diet plan' });
  }
};

export const getMemberDietPlan = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.params.memberId as string;

    // Prevent IDOR: members may only inspect their own diet plan
    if (req.user?.role === 'MEMBER' && req.user.id !== userId) {
      return res.status(403).json({ status: 'error', message: 'Forbidden: You can only view your own diet plan' });
    }

    const profile = await prisma.memberProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ status: 'error', message: 'Member profile not found' });

    const activeDietPlan = await prisma.dietPlan.findFirst({
      where: { memberId: profile.id, isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ status: 'success', data: activeDietPlan });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch diet plan' });
  }
};

export const assignWorkoutRoutine = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.params.memberId as string;
    const { title, notes, exercisesData } = workoutRoutineSchema.parse(req.body);
    const assignedBy = req.user?.id;

    const profile = await prisma.memberProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ status: 'error', message: 'Member profile not found' });
    const memberProfileId = profile.id;

    const serializedExercises = typeof exercisesData === 'string' ? exercisesData : JSON.stringify(exercisesData);

    const newRoutine = await prisma.$transaction(async (tx) => {
      await tx.workoutRoutine.updateMany({
        where: { memberId: memberProfileId, isActive: true },
        data: { isActive: false },
      });

      return tx.workoutRoutine.create({
        data: {
          memberId: memberProfileId,
          title: title || 'Personalized Workout Routine',
          notes,
          exercisesData: serializedExercises,
          assignedBy,
        },
      });
    });

    res.status(201).json({ status: 'success', data: newRoutine });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ status: 'error', message: 'Validation failed', errors: (error as any).errors });
    }
    console.error(error);
    res.status(500).json({ status: 'error', message: 'Failed to assign workout routine' });
  }
};

export const getMemberWorkoutRoutine = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.params.memberId as string;

    // Prevent IDOR: members may only inspect their own workout routine
    if (req.user?.role === 'MEMBER' && req.user.id !== userId) {
      return res.status(403).json({ status: 'error', message: 'Forbidden: You can only view your own workout routine' });
    }

    const profile = await prisma.memberProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ status: 'error', message: 'Member profile not found' });

    const activeRoutine = await prisma.workoutRoutine.findFirst({
      where: { memberId: profile.id, isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ status: 'success', data: activeRoutine });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch workout routine' });
  }
};
