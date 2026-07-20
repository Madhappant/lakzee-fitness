import { Request, Response, NextFunction } from 'express';
import { prisma } from '../app';
import { z } from 'zod';

const planSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().min(0),
  durationMonths: z.number().min(1),
  features: z.array(z.string()).optional(),
  isActive: z.boolean().optional()
});

export const createPlan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validatedData = planSchema.parse(req.body);
    const plan = await prisma.membershipPlan.create({ data: validatedData });
    res.status(201).json({ status: 'success', data: plan });
  } catch (error) {
    next(error);
  }
};

export const getPlans = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const plans = await prisma.membershipPlan.findMany({ where: { isActive: true } });
    res.json({ status: 'success', data: plans });
  } catch (error) {
    next(error);
  }
};

export const updatePlan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const validatedData = planSchema.partial().parse(req.body);
    const plan = await prisma.membershipPlan.update({
      where: { id },
      data: validatedData
    });
    res.json({ status: 'success', data: plan });
  } catch (error) {
    next(error);
  }
};

export const deletePlan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await prisma.membershipPlan.delete({ where: { id } });
    res.json({ status: 'success', message: 'Plan deleted successfully' });
  } catch (error) {
    next(error);
  }
};
