import { Request, Response } from 'express';
import { prisma } from '../app';
import { z } from 'zod';

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

export const getSettings = async (req: Request, res: Response) => {
  try {
    let settings = await prisma.settings.findUnique({ where: { id: "1" } });
    if (!settings) {
      settings = await prisma.settings.create({ data: { id: "1", gymName: "Lakzee Fitness Studio" } });
    }
    res.json({ status: 'success', data: settings });
  } catch {
    res.status(500).json({ status: 'error', message: 'Failed to fetch settings' });
  }
};

export const updateSettings = async (req: Request, res: Response) => {
  try {
    const validated = updateSettingsSchema.parse(req.body);
    const updated = await prisma.settings.upsert({
      where: { id: "1" },
      update: validated,
      create: { id: "1", gymName: validated.gymName || "Lakzee Fitness Studio", ...validated }
    });
    res.json({ status: 'success', data: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ status: 'error', message: 'Validation failed', errors: (error as any).errors });
    }
    res.status(500).json({ status: 'error', message: 'Failed to update settings' });
  }
};
