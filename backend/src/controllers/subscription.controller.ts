import { Request, Response } from 'express';
import { prisma } from '../app';
import { memoryCache } from '../utils/cache';

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

    // Invalidate dashboard stats cache
    memoryCache.delete('dashboard_stats');

    // Generate corresponding Invoice and Payment record
    try {
      const gstRate = (plan.gstPercentage || 18.0) / 100;
      const basePrice = plan.price / (1 + gstRate);
      const gstAmount = plan.price - basePrice;
      const invoiceNumber = `INV-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

      const invoice = await prisma.invoice.create({
        data: {
          invoiceNumber,
          memberId,
          subscriptionId: subscription.id,
          subtotal: Math.round(basePrice * 100) / 100,
          discount: 0,
          gstAmount: Math.round(gstAmount * 100) / 100,
          totalAmount: plan.price,
          status: paymentStatus === 'PAID' ? 'COMPLETED' : 'PENDING',
        }
      });

      const paidAmount = paymentStatus === 'PAID' ? plan.price : Math.max(0, plan.price - (Number(balanceAmount) || 0));
      if (paidAmount > 0) {
        await prisma.payment.create({
          data: {
            invoiceId: invoice.id,
            amount: paidAmount,
            method: paymentMethod || 'CASH',
            status: 'COMPLETED'
          }
        });
      }
    } catch (invErr) {
      console.error("Warning: Failed to auto-generate invoice:", invErr);
    }

    res.status(201).json({ status: 'success', data: subscription });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to create subscription' });
  }
};

export const getSubscriptions = async (req: Request, res: Response) => {
  try {
    const { search, status, paymentStatus } = req.query;

    const today = new Date();
    await prisma.subscription.updateMany({
      where: {
        status: 'ACTIVE',
        endDate: { lt: today }
      },
      data: { status: 'EXPIRED' }
    });

    const where: any = {};

    if (status && status !== 'All Status' && status !== 'ALL') {
      where.status = String(status).toUpperCase();
    }

    if (paymentStatus && paymentStatus !== 'All Payments' && paymentStatus !== 'ALL') {
      where.paymentStatus = String(paymentStatus).toUpperCase();
    }

    if (search) {
      const searchStr = String(search).trim();
      where.OR = [
        { member: { memberId: { contains: searchStr, mode: 'insensitive' } } },
        { member: { user: { firstName: { contains: searchStr, mode: 'insensitive' } } } },
        { member: { user: { lastName: { contains: searchStr, mode: 'insensitive' } } } },
        { member: { user: { email: { contains: searchStr, mode: 'insensitive' } } } },
        { member: { user: { phone: { contains: searchStr, mode: 'insensitive' } } } },
        { plan: { name: { contains: searchStr, mode: 'insensitive' } } },
      ];
    }

    const subscriptions = await prisma.subscription.findMany({
      where,
      include: { plan: true, member: { include: { user: true } } },
      orderBy: { createdAt: 'desc' }
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

    const [todaysSubs, monthSubs, totalRecords, pendingSubs] = await Promise.all([
      prisma.subscription.findMany({
        where: { createdAt: { gte: today } },
        include: { plan: true }
      }),
      prisma.subscription.findMany({
        where: { createdAt: { gte: firstDayOfMonth } },
        include: { plan: true }
      }),
      prisma.subscription.count(),
      prisma.subscription.findMany({
        where: { paymentStatus: 'PENDING' },
        include: { plan: true }
      })
    ]);

    const todaysCollection = todaysSubs.reduce((sum, sub) => {
      const price = sub.plan?.price || 0;
      if (sub.paymentStatus === 'PAID') return sum + price;
      if (sub.paymentStatus === 'PENDING') {
        if (sub.balanceAmount > 0) return sum + Math.max(0, price - sub.balanceAmount);
        return sum;
      }
      return sum;
    }, 0);

    const thisMonth = monthSubs.reduce((sum, sub) => {
      const price = sub.plan?.price || 0;
      if (sub.paymentStatus === 'PAID') return sum + price;
      if (sub.paymentStatus === 'PENDING') {
        if (sub.balanceAmount > 0) return sum + Math.max(0, price - sub.balanceAmount);
        return sum;
      }
      return sum;
    }, 0);

    const totalPending = pendingSubs.reduce((sum, sub) => {
      const price = sub.plan?.price || 0;
      if (sub.balanceAmount > 0) return sum + sub.balanceAmount;
      return sum + price;
    }, 0);

    res.json({
      status: 'success',
      data: {
        todaysCollection,
        thisMonth,
        totalRecords,
        totalPending
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

    if (startDate || planId) {
      const currentSub = await prisma.subscription.findUnique({ where: { id }, include: { plan: true } });
      if (currentSub) {
        const effectivePlanId = planId || currentSub.planId;
        const effectivePlan = planId ? await prisma.membershipPlan.findUnique({ where: { id: planId } }) : currentSub.plan;
        if (effectivePlan) {
          const start = startDate ? new Date(startDate) : new Date(currentSub.startDate);
          const end = new Date(start);
          end.setDate(end.getDate() + effectivePlan.durationDays);
          dataToUpdate.startDate = start;
          dataToUpdate.endDate = end;
          dataToUpdate.planId = effectivePlanId;
        }
      }
    }

    const updated = await prisma.subscription.update({
      where: { id },
      data: dataToUpdate
    });
    
    // Invalidate dashboard stats cache
    memoryCache.delete('dashboard_stats');

    res.json({ status: 'success', data: updated });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to update subscription' });
  }
};
export const deleteSubscription = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    
    // Clean up associated invoice and payments first to avoid foreign key violation
    const sub = await prisma.subscription.findUnique({
      where: { id },
      include: { invoice: true }
    });

    if (sub?.invoice) {
      await prisma.payment.deleteMany({ where: { invoiceId: sub.invoice.id } });
      await prisma.invoice.delete({ where: { id: sub.invoice.id } });
    }

    await prisma.subscription.delete({ where: { id } });
    
    // Invalidate dashboard stats cache
    memoryCache.delete('dashboard_stats');

    res.json({ status: 'success', message: 'Subscription deleted successfully' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to delete subscription' });
  }
};
