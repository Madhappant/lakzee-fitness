import { Request, Response } from 'express';
import { prisma } from '../app';

export const createSubscription = async (req: Request, res: Response) => {
  try {
    const { memberId, planId, startDate, paymentStatus = 'PAID', paymentMethod = 'CASH', balanceAmount = 0 } = req.body;
    
    const plan = await prisma.membershipPlan.findUnique({ where: { id: planId } });
    if (!plan) return res.status(404).json({ status: 'error', message: 'Plan not found' });

    const start = new Date(startDate);
    const end = new Date(start);
    end.setDate(end.getDate() + plan.durationDays);

    const subscription = await prisma.subscription.create({
      data: {
        memberId,
        planId,
        startDate: start,
        endDate: end,
        status: 'ACTIVE',
        paymentStatus,
        paymentMethod,
        balanceAmount: Number(balanceAmount) || 0
      }
    });

    res.status(201).json({ status: 'success', data: subscription });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to create subscription' });
  }
};

export const getSubscriptions = async (req: Request, res: Response) => {
  try {
    const today = new Date();
    await prisma.subscription.updateMany({
      where: {
        status: 'ACTIVE',
        endDate: { lt: today }
      },
      data: { status: 'EXPIRED' }
    });

    const subscriptions = await prisma.subscription.findMany({
      include: { plan: true, member: { include: { user: true } } }
    });
    res.json({ status: 'success', data: subscriptions });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to fetch subscriptions' });
  }
};

export const getPaymentStats = async (req: Request, res: Response) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const todaysSubs = await prisma.subscription.findMany({
      where: { createdAt: { gte: today } },
      include: { plan: true }
    });
    const todaysCollection = todaysSubs.reduce((sum, sub) => sum + ((sub.plan?.price || 0) - sub.balanceAmount), 0);

    const monthSubs = await prisma.subscription.findMany({
      where: { createdAt: { gte: firstDayOfMonth } },
      include: { plan: true }
    });
    const thisMonth = monthSubs.reduce((sum, sub) => sum + ((sub.plan?.price || 0) - sub.balanceAmount), 0);

    const totalRecords = await prisma.subscription.count();

    res.json({
      status: 'success',
      data: {
        todaysCollection,
        thisMonth,
        totalRecords
      }
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to fetch payment stats' });
  }
};

export const updateSubscription = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { status, paymentStatus, paymentMethod, startDate, planId, balanceAmount } = req.body;

    const dataToUpdate: any = {
      status,
      paymentStatus,
      paymentMethod
    };

    if (balanceAmount !== undefined) {
      dataToUpdate.balanceAmount = Number(balanceAmount);
    }

    if (startDate && planId) {
      const plan = await prisma.membershipPlan.findUnique({ where: { id: planId } });
      if (plan) {
        const start = new Date(startDate);
        const end = new Date(start);
        end.setDate(end.getDate() + plan.durationDays);
        dataToUpdate.startDate = start;
        dataToUpdate.endDate = end;
        dataToUpdate.planId = planId;
      }
    }

    const updated = await prisma.subscription.update({
      where: { id },
      data: dataToUpdate
    });
    res.json({ status: 'success', data: updated });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to update subscription' });
  }
};

export const deleteSubscription = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    await prisma.subscription.delete({ where: { id } });
    res.json({ status: 'success', message: 'Subscription deleted successfully' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to delete subscription' });
  }
};

