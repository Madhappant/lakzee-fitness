import { Request, Response } from 'express';
import { prisma } from '../app';
import { memoryCache } from '../utils/cache';
import { z } from 'zod';

const createSubscriptionSchema = z.object({
  memberId: z.string().min(1),
  planId: z.string().min(1),
  startDate: z.string().refine((s) => !isNaN(Date.parse(s)), 'Invalid startDate'),
  status: z.enum(['ACTIVE', 'EXPIRED', 'FROZEN', 'CANCELLED']).optional(),
  paymentStatus: z.enum(['PAID', 'PENDING']).default('PAID'),
  paymentMethod: z.enum(['CASH', 'UPI', 'CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'SPLIT']).default('CASH'),
  balanceAmount: z.preprocess((v) => (v === '' || v === undefined ? 0 : Number(v)), z.number().min(0)).default(0),
});

const updateSubscriptionSchema = z.object({
  status: z.enum(['ACTIVE', 'EXPIRED', 'FROZEN', 'CANCELLED']).optional(),
  paymentStatus: z.enum(['PAID', 'PENDING']).optional(),
  paymentMethod: z.enum(['CASH', 'UPI', 'CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'SPLIT']).optional(),
  startDate: z.string().refine((s) => !s || !isNaN(Date.parse(s)), 'Invalid startDate').optional(),
  planId: z.string().min(1).optional(),
  balanceAmount: z.preprocess((v) => (v === '' || v === undefined ? undefined : Number(v)), z.number().min(0).optional()),
});

const roundCurrency = (val: number) => Math.round(val * 100) / 100;

export const createSubscription = async (req: Request, res: Response) => {
  try {
    const validated = createSubscriptionSchema.parse(req.body);
    const { memberId, planId, startDate, paymentStatus, paymentMethod } = validated;
    const effectiveBalance = paymentStatus === 'PAID' ? 0 : Math.max(0, roundCurrency(validated.balanceAmount));

    const [member, plan] = await Promise.all([
      prisma.memberProfile.findUnique({ where: { id: memberId } }),
      prisma.membershipPlan.findUnique({ where: { id: planId } }),
    ]);
    if (!member) return res.status(404).json({ status: 'error', message: 'Member not found' });
    if (!plan) return res.status(404).json({ status: 'error', message: 'Plan not found' });

    const start = new Date(startDate);
    const end = new Date(start);
    end.setDate(end.getDate() + plan.durationDays);

    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    const computedStatus = validated.status || (end < todayMidnight ? 'EXPIRED' : 'ACTIVE');

    const subscription = await prisma.$transaction(async (tx) => {
      const sub = await tx.subscription.create({
        data: {
          memberId,
          planId,
          startDate: start,
          endDate: end,
          status: computedStatus,
          paymentStatus,
          paymentMethod,
          balanceAmount: effectiveBalance,
        },
      });

      const gstRate = (plan.gstPercentage || 18.0) / 100;
      const basePrice = plan.price / (1 + gstRate);
      const gstAmount = plan.price - basePrice;
      const invoiceNumber = `INV-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

      const invoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          memberId,
          subscriptionId: sub.id,
          subtotal: roundCurrency(basePrice),
          discount: 0,
          gstAmount: roundCurrency(gstAmount),
          totalAmount: roundCurrency(plan.price),
          status: paymentStatus === 'PAID' ? 'COMPLETED' : 'PENDING',
        },
      });

      const paidAmount = paymentStatus === 'PAID' ? plan.price : Math.max(0, roundCurrency(plan.price - effectiveBalance));
      if (paidAmount > 0) {
        await tx.payment.create({
          data: {
            invoiceId: invoice.id,
            amount: roundCurrency(paidAmount),
            method: paymentMethod || 'CASH',
            status: 'COMPLETED',
          },
        });
      }

      return sub;
    });

    memoryCache.delete('dashboard_stats');
    res.status(201).json({ status: 'success', data: subscription });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ status: 'error', message: 'Validation failed', errors: (error as any).errors });
    }
    res.status(500).json({ status: 'error', message: 'Failed to create subscription' });
  }
};

export const getSubscriptions = async (req: Request, res: Response) => {
  try {
    const { search, status, paymentStatus } = req.query;

    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);

    const expireResult = await prisma.subscription.updateMany({
      where: {
        status: 'ACTIVE',
        endDate: { lt: todayMidnight },
      },
      data: { status: 'EXPIRED' },
    });

    if (expireResult.count > 0) {
      memoryCache.delete('dashboard_stats');
    }

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
      orderBy: { createdAt: 'desc' },
    });
    res.json({ status: 'success', data: subscriptions });
  } catch {
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
        include: { plan: true },
      }),
      prisma.subscription.findMany({
        where: { createdAt: { gte: firstDayOfMonth } },
        include: { plan: true },
      }),
      prisma.subscription.count(),
      prisma.subscription.findMany({
        where: { paymentStatus: 'PENDING' },
        include: { plan: true },
      }),
    ]);

    const calcCollected = (subs: any[]) =>
      roundCurrency(
        subs.reduce((sum, sub) => {
          const price = sub.plan?.price || 0;
          if (sub.paymentStatus === 'PAID') return sum + price;
          if (sub.paymentStatus === 'PENDING' && sub.balanceAmount > 0) {
            return sum + Math.max(0, price - sub.balanceAmount);
          }
          return sum;
        }, 0)
      );

    const todaysCollection = calcCollected(todaysSubs);
    const thisMonth = calcCollected(monthSubs);

    const totalPending = roundCurrency(
      pendingSubs.reduce((sum, sub) => {
        const price = sub.plan?.price || 0;
        if (sub.balanceAmount > 0) return sum + sub.balanceAmount;
        return sum + price;
      }, 0)
    );

    res.json({
      status: 'success',
      data: {
        todaysCollection,
        thisMonth,
        totalRecords,
        totalPending,
      },
    });
  } catch {
    res.status(500).json({ status: 'error', message: 'Failed to fetch payment stats' });
  }
};

export const updateSubscription = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const validated = updateSubscriptionSchema.parse(req.body);
    const { status, paymentStatus, paymentMethod, startDate, planId, balanceAmount } = validated;

    const currentSub = await prisma.subscription.findUnique({
      where: { id },
      include: { plan: true, invoice: { include: { payments: true } } },
    });
    if (!currentSub) {
      return res.status(404).json({ status: 'error', message: 'Subscription not found' });
    }

    const effectivePlanId = planId || currentSub.planId;
    const effectivePlan = planId
      ? await prisma.membershipPlan.findUnique({ where: { id: planId } })
      : currentSub.plan;
    if (!effectivePlan) {
      return res.status(404).json({ status: 'error', message: 'Plan not found' });
    }

    const effectivePaymentStatus = paymentStatus ?? currentSub.paymentStatus;
    const effectiveMethod = paymentMethod ?? currentSub.paymentMethod;
    const effectiveBalance =
      effectivePaymentStatus === 'PAID'
        ? 0
        : roundCurrency(balanceAmount !== undefined ? balanceAmount : currentSub.balanceAmount);

    const dataToUpdate: any = {
      ...(status !== undefined && { status }),
      paymentStatus: effectivePaymentStatus,
      paymentMethod: effectiveMethod,
      balanceAmount: effectiveBalance,
    };

    if (startDate || planId) {
      const start = startDate ? new Date(startDate) : new Date(currentSub.startDate);
      const end = new Date(start);
      end.setDate(end.getDate() + effectivePlan.durationDays);
      dataToUpdate.startDate = start;
      dataToUpdate.endDate = end;
      dataToUpdate.planId = effectivePlanId;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedSub = await tx.subscription.update({
        where: { id },
        data: dataToUpdate,
      });

      if (currentSub.invoice) {
        const gstRate = (effectivePlan.gstPercentage || 18.0) / 100;
        const basePrice = effectivePlan.price / (1 + gstRate);
        const gstAmount = effectivePlan.price - basePrice;

        await tx.invoice.update({
          where: { id: currentSub.invoice.id },
          data: {
            subtotal: roundCurrency(basePrice),
            gstAmount: roundCurrency(gstAmount),
            totalAmount: roundCurrency(effectivePlan.price),
            status: effectivePaymentStatus === 'PAID' ? 'COMPLETED' : 'PENDING',
          },
        });

        const totalPaidSoFar = currentSub.invoice.payments.reduce((acc, p) => acc + p.amount, 0);
        const targetPaid =
          effectivePaymentStatus === 'PAID'
            ? effectivePlan.price
            : Math.max(0, roundCurrency(effectivePlan.price - effectiveBalance));

        if (targetPaid > totalPaidSoFar) {
          await tx.payment.create({
            data: {
              invoiceId: currentSub.invoice.id,
              amount: roundCurrency(targetPaid - totalPaidSoFar),
              method: effectiveMethod,
              status: 'COMPLETED',
              notes: 'Subscription payment update',
            },
          });
        }
      }

      return updatedSub;
    });

    memoryCache.delete('dashboard_stats');
    res.json({ status: 'success', data: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ status: 'error', message: 'Validation failed', errors: (error as any).errors });
    }
    res.status(500).json({ status: 'error', message: 'Failed to update subscription' });
  }
};

export const deleteSubscription = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const sub = await prisma.subscription.findUnique({
      where: { id },
      include: { invoice: true },
    });
    if (!sub) {
      return res.status(404).json({ status: 'error', message: 'Subscription not found' });
    }

    await prisma.$transaction(async (tx) => {
      if (sub.invoice) {
        await tx.payment.deleteMany({ where: { invoiceId: sub.invoice.id } });
        await tx.invoice.delete({ where: { id: sub.invoice.id } });
      }
      await tx.subscription.delete({ where: { id } });
    });

    memoryCache.delete('dashboard_stats');
    res.json({ status: 'success', message: 'Subscription deleted successfully' });
  } catch {
    res.status(500).json({ status: 'error', message: 'Failed to delete subscription' });
  }
};
