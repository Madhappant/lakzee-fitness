import { Request, Response } from 'express';
import { prisma } from '../app';

export const assignDietPlan = async (req: Request, res: Response) => {
  try {
    const userId = req.params.memberId as string;
    const { title, notes, mealsData } = req.body;
    const assignedBy = req.user?.id;

    const profile = await prisma.memberProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ status: 'error', message: 'Member profile not found' });
    const memberProfileId = profile.id;

    // We can archive old active plans by marking them inactive
    await prisma.dietPlan.updateMany({
      where: { memberId: memberProfileId, isActive: true },
      data: { isActive: false }
    });

    const newDietPlan = await prisma.dietPlan.create({
      data: {
        memberId: memberProfileId,
        title,
        notes,
        mealsData: JSON.stringify(mealsData),
        assignedBy,
      }
    });

    res.status(201).json({ status: 'success', data: newDietPlan });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: 'error', message: 'Failed to assign diet plan' });
  }
};

export const getMemberDietPlan = async (req: Request, res: Response) => {
  try {
    const userId = req.params.memberId as string;
    const profile = await prisma.memberProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ status: 'error', message: 'Member profile not found' });
    
    const activeDietPlan = await prisma.dietPlan.findFirst({
      where: { memberId: profile.id, isActive: true },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ status: 'success', data: activeDietPlan });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch diet plan' });
  }
};

export const assignWorkoutRoutine = async (req: Request, res: Response) => {
  try {
    const userId = req.params.memberId as string;
    const { title, notes, exercisesData } = req.body;
    const assignedBy = req.user?.id;

    const profile = await prisma.memberProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ status: 'error', message: 'Member profile not found' });
    const memberProfileId = profile.id;

    await prisma.workoutRoutine.updateMany({
      where: { memberId: memberProfileId, isActive: true },
      data: { isActive: false }
    });

    const newRoutine = await prisma.workoutRoutine.create({
      data: {
        memberId: memberProfileId,
        title,
        notes,
        exercisesData: JSON.stringify(exercisesData),
        assignedBy,
      }
    });

    res.status(201).json({ status: 'success', data: newRoutine });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: 'error', message: 'Failed to assign workout routine' });
  }
};

export const getMemberWorkoutRoutine = async (req: Request, res: Response) => {
  try {
    const userId = req.params.memberId as string;
    const profile = await prisma.memberProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ status: 'error', message: 'Member profile not found' });

    const activeRoutine = await prisma.workoutRoutine.findFirst({
      where: { memberId: profile.id, isActive: true },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ status: 'success', data: activeRoutine });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch workout routine' });
  }
};
