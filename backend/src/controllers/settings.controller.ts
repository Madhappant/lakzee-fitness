import { Request, Response } from 'express';
import { prisma } from '../app';
import { z } from 'zod';
import { asyncHandler } from '../middlewares/error.middleware';
import { CACHE_KEYS, invalidateCacheScopes, memoryCache } from '../utils/cache';

const updateSettingsSchema = z.object({
  gymName: z.string().trim().min(1).max(150).optional(),
  logoUrl: z.string().max(500).nullable().optional(),
  branch: z.string().max(150).nullable().optional(),
  workingHours: z.string().max(150).nullable().optional(),
  gstNumber: z.string().max(50).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  contactEmail: z.string().trim().email().or(z.literal('')).nullable().optional(),
  contactPhone: z.string().max(30).nullable().optional(),
});

const SETTINGS_CACHE_TTL_SECONDS = 300;

export const getSettings = asyncHandler(async (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');

  const cached = memoryCache.get(CACHE_KEYS.GYM_SETTINGS);
  if (cached) {
    return res.json({ status: 'success', data: cached });
  }

  let settings = await prisma.settings.findUnique({ where: { id: '1' } });
  if (!settings) {
    settings = await prisma.settings.create({ data: { id: '1', gymName: 'Lakzee Fitness Studio' } });
  }

  memoryCache.set(CACHE_KEYS.GYM_SETTINGS, settings, SETTINGS_CACHE_TTL_SECONDS);
  res.json({ status: 'success', data: settings });
});

export const updateSettings = asyncHandler(async (req: Request, res: Response) => {
  const validated = updateSettingsSchema.parse(req.body);
  const updated = await prisma.settings.upsert({
    where: { id: '1' },
    update: validated,
    create: { id: '1', gymName: validated.gymName || 'Lakzee Fitness Studio', ...validated },
  });

  invalidateCacheScopes('settings');
  memoryCache.set(CACHE_KEYS.GYM_SETTINGS, updated, SETTINGS_CACHE_TTL_SECONDS);

  res.json({ status: 'success', data: updated });
});
