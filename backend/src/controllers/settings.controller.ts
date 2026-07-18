import { Request, Response } from 'express';
import { prisma } from '../app';

export const getSettings = async (req: Request, res: Response) => {
  try {
    let settings = await prisma.settings.findUnique({ where: { id: "1" } });
    if (!settings) {
      settings = await prisma.settings.create({ data: { id: "1", gymName: "Lakzee Fitness Studio" } });
    }
    res.json({ status: 'success', data: settings });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to fetch settings' });
  }
};

export const updateSettings = async (req: Request, res: Response) => {
  try {
    const updated = await prisma.settings.upsert({
      where: { id: "1" },
      update: req.body,
      create: { id: "1", ...req.body }
    });
    res.json({ status: 'success', data: updated });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to update settings' });
  }
};
