import { Request, Response } from 'express';
import { prisma } from '../app';

export const createPlan = async (req: Request, res: Response) => {
  try {
    const plan = await prisma.membershipPlan.create({ data: req.body });
    res.status(201).json({ status: 'success', data: plan });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to create plan' });
  }
};

export const getPlans = async (req: Request, res: Response) => {
  try {
    const plans = await prisma.membershipPlan.findMany({ where: { isActive: true } });
    res.json({ status: 'success', data: plans });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to fetch plans' });
  }
};

export const updatePlan = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const plan = await prisma.membershipPlan.update({
      where: { id },
      data: req.body
    });
    res.json({ status: 'success', data: plan });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to update plan' });
  }
};

export const deletePlan = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.membershipPlan.delete({ where: { id } });
    res.json({ status: 'success', message: 'Plan deleted successfully' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to delete plan' });
  }
};
