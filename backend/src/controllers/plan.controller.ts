/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from 'express';
import { prisma } from '../app';
import { z } from 'zod';
import { asyncHandler } from '../middlewares/error.middleware';
import { CACHE_KEYS, invalidateCacheScopes, memoryCache } from '../utils/cache';

const planSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().optional(),
  price: z.number().finite().min(0),
  durationDays: z.number().int().min(1),
  gstPercentage: z.number().finite().min(0).max(100).optional(),
  isActive: z.boolean().optional(),
});

const PLANS_CACHE_TTL_SECONDS = 300; // 5 minutes (was mistakenly 300000s = 3.47 days)

export const createPlan = asyncHandler(async (req: Request, res: Response) => {
  const rawData = {
    ...req.body,
    price: Number(req.body.price),
    durationDays: Number(req.body.durationDays),
    ...(req.body.gstPercentage !== undefined && { gstPercentage: Number(req.body.gstPercentage) }),
  };
  const planData = planSchema.parse(rawData);
  const plan = await prisma.membershipPlan.create({ data: planData });

  invalidateCacheScopes('plans', 'dashboard', 'reports', 'members');

  res.status(201).json({ status: 'success', data: plan });
});

export const getPlans = asyncHandler(async (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');

  const cachedPlans = memoryCache.get(CACHE_KEYS.MEMBERSHIP_PLANS);
  if (cachedPlans) {
    return res.json({ status: 'success', data: cachedPlans });
  }

  const plans = await prisma.membershipPlan.findMany({
    where: { isActive: true },
    orderBy: { price: 'asc' },
  });
  memoryCache.set(CACHE_KEYS.MEMBERSHIP_PLANS, plans, PLANS_CACHE_TTL_SECONDS);
  res.json({ status: 'success', data: plans });
});

export const updatePlan = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const rawData = { ...req.body };
  if (rawData.price !== undefined) rawData.price = Number(rawData.price);
  if (rawData.durationDays !== undefined) rawData.durationDays = Number(rawData.durationDays);
  if (rawData.gstPercentage !== undefined) rawData.gstPercentage = Number(rawData.gstPercentage);

  const planData = planSchema.partial().parse(rawData);

  const plan = await prisma.membershipPlan.update({
    where: { id },
    data: planData,
  });

  invalidateCacheScopes('plans', 'dashboard', 'reports', 'members');

  res.json({ status: 'success', data: plan });
});

export const deletePlan = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  // Soft-delete preserves FK integrity on historical Subscriptions & Invoices
  await prisma.membershipPlan.update({
    where: { id },
    data: { isActive: false },
  });

  invalidateCacheScopes('plans', 'dashboard', 'reports', 'members');

  res.json({ status: 'success', message: 'Plan deleted successfully' });
});
