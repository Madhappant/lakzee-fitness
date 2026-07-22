import { Request, Response } from 'express';
import { prisma } from '../app';

export const createSubscription = async (req: Request, res: Response) => {
  try {
    const { memberId, planId, startDate, paymentStatus = 'PAID' } = req.body;
    
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
        paymentStatus
      }
    });

    res.status(201).json({ status: 'success', data: subscription });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to create subscription' });
  }
};

export const getSubscriptions = async (req: Request, res: Response) => {
  try {
    // Auto-expire subscriptions whose endDate has passed
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

    // Today's Collection (Only Paid)
    const todaysSubs = await prisma.subscription.findMany({
      where: { createdAt: { gte: today }, paymentStatus: 'PAID' },
      include: { plan: true }
    });
    const todaysCollection = todaysSubs.reduce((acc, sub) => acc + (sub.plan?.price || 0), 0);

    // This Month Collection (Only Paid)
    const monthSubs = await prisma.subscription.findMany({
      where: { createdAt: { gte: firstDayOfMonth }, paymentStatus: 'PAID' },
      include: { plan: true }
    });
    const thisMonth = monthSubs.reduce((acc, sub) => acc + (sub.plan?.price || 0), 0);

    // Total Records
    const totalRecords = await prisma.subscription.count();

    res.json({
      status: 'success',
      data: { todaysCollection, thisMonth, totalRecords }
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to fetch payment stats' });
  }
};

export const updateSubscription = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { planId, startDate, status, paymentStatus } = req.body;

    const subscription = await prisma.subscription.findUnique({ where: { id } });
    if (!subscription) return res.status(404).json({ status: 'error', message: 'Subscription not found' });

    let endDate = subscription.endDate;
    if (planId || startDate) {
      const plan = await prisma.membershipPlan.findUnique({ where: { id: planId || subscription.planId } });
      if (plan) {
        const start = new Date(startDate || subscription.startDate);
        endDate = new Date(start);
        endDate.setDate(endDate.getDate() + plan.durationDays);
      }
    }

    const updatedSub = await prisma.subscription.update({
      where: { id },
      data: {
        ...(planId && { planId }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(startDate || planId ? { endDate } : {}),
        ...(status && { status }),
        ...(paymentStatus && { paymentStatus }),
      }
    });

    res.json({ status: 'success', data: updatedSub });
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
