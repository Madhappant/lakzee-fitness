import { Request, Response, NextFunction } from 'express';
import { prisma } from '../app';
import { z } from 'zod';
import { memoryCache } from '../utils/cache';

const planSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().optional(),
  price: z.number().finite().min(0),
  durationDays: z.number().int().min(1),
  gstPercentage: z.number().finite().min(0).max(100).optional(),
  isActive: z.boolean().optional()
});

export const createPlan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawData = {
      ...req.body,
      price: Number(req.body.price),
      durationDays: Number(req.body.durationDays),
      ...(req.body.gstPercentage !== undefined && { gstPercentage: Number(req.body.gstPercentage) })
    };
    const planData = planSchema.parse(rawData);
    const plan = await prisma.membershipPlan.create({ data: planData });
    
    // Invalidate plans and dashboard cache
    memoryCache.delete('membership_plans');
    memoryCache.delete('dashboard_stats');
    
    res.status(201).json({ status: 'success', data: plan });
  } catch (error) {
    next(error);
  }
};

export const getPlans = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cachedPlans = memoryCache.get('membership_plans');
    if (cachedPlans) {
      return res.json({ status: 'success', data: cachedPlans });
    }

    const plans = await prisma.membershipPlan.findMany({ where: { isActive: true } });
    memoryCache.set('membership_plans', plans, 300000); // 5 min TTL
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
    if (rawData.gstPercentage !== undefined) rawData.gstPercentage = Number(rawData.gstPercentage);
    
    const planData = planSchema.partial().parse(rawData);
    
    const plan = await prisma.membershipPlan.update({
      where: { id },
      data: planData
    });
    
    // Invalidate plans and dashboard cache
    memoryCache.delete('membership_plans');
    memoryCache.delete('dashboard_stats');

    res.json({ status: 'success', data: plan });
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return res.status(404).json({ status: 'error', message: 'Plan not found' });
    }
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
    
    // Invalidate plans and dashboard cache
    memoryCache.delete('membership_plans');
    memoryCache.delete('dashboard_stats');

    res.json({ status: 'success', message: 'Plan deleted successfully' });
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return res.status(404).json({ status: 'error', message: 'Plan not found' });
    }
    next(error);
  }
};
