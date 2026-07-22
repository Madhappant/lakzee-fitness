import { Request, Response, NextFunction } from 'express';
import { prisma } from '../app';
import { z } from 'zod';

const planSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().min(0),
  durationDays: z.number().min(1),
  features: z.array(z.string()).optional(),
  isActive: z.boolean().optional()
});

export const createPlan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Cast numeric fields from form if needed, but since it's JSON from UI, they are usually strings if not converted
    // Assuming the API lib converts it or we need to preprocess:
    const rawData = { ...req.body, price: Number(req.body.price), durationDays: Number(req.body.durationDays) };
    const validatedData = planSchema.parse(rawData);
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
    const id = req.params.id as string;
    
    // Cast fields if they exist
    const rawData = { ...req.body };
    if (rawData.price !== undefined) rawData.price = Number(rawData.price);
    if (rawData.durationDays !== undefined) rawData.durationDays = Number(rawData.durationDays);
    
    const validatedData = planSchema.partial().parse(rawData);
    
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
    const id = req.params.id as string;
    // Perform a soft-delete instead of hard-delete to avoid breaking Foreign Key constraints on Subscriptions
    await prisma.membershipPlan.update({ 
      where: { id },
      data: { isActive: false }
    });
    res.json({ status: 'success', message: 'Plan deleted successfully' });
  } catch (error) {
    next(error);
  }
};
