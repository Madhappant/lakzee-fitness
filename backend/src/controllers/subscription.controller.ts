/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from 'express';
import { prisma } from '../app';
import { asyncHandler } from '../middlewares/error.middleware';
import { NotFoundError } from '../utils/errors';
import { invalidateCacheScopes } from '../utils/cache';
import {
  computeCollectedAmount,
  computeInvoiceBreakdown,
  computePendingBalance,
  createSubscriptionWithInvoice,
  roundCurrency,
  syncExpiredSubscriptions,
} from '../services/subscription-ledger.service';
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

export const createSubscription = asyncHandler(async (req: Request, res: Response) => {
  const validated = createSubscriptionSchema.parse(req.body);
  const { subscription } = await createSubscriptionWithInvoice(prisma, validated);
  res.status(201).json({ status: 'success', data: subscription });
});

export const getSubscriptions = asyncHandler(async (req: Request, res: Response) => {
  const { search, status, paymentStatus } = req.query;

  // Cooldown-guarded sync prevents an UPDATE write lock on every GET request
  await syncExpiredSubscriptions(prisma, 300);

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

  // Strip sensitive User credentials (password, OTPs) with explicit select projection
  const subscriptions = await prisma.subscription.findMany({
    where,
    include: {
      plan: true,
      member: {
        select: {
          id: true,
          memberId: true,
          photoUrl: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ status: 'success', data: subscriptions });
});

export const getPaymentStats = asyncHandler(async (_req: Request, res: Response) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const [monthSubs, totalRecords, pendingSubs] = await Promise.all([
    prisma.subscription.findMany({
      where: { createdAt: { gte: firstDayOfMonth } },
      select: {
        createdAt: true,
        paymentStatus: true,
        balanceAmount: true,
        plan: { select: { price: true } },
      },
    }),
    prisma.subscription.count(),
    prisma.subscription.findMany({
      where: { paymentStatus: 'PENDING' },
      select: {
        paymentStatus: true,
        balanceAmount: true,
        plan: { select: { price: true } },
      },
    }),
  ]);

  let todaysCollection = 0;
  let thisMonth = 0;
  for (const sub of monthSubs) {
    const collected = computeCollectedAmount(sub);
    thisMonth += collected;
    if (sub.createdAt >= today) {
      todaysCollection += collected;
    }
  }

  const totalPending = roundCurrency(
    pendingSubs.reduce((sum, sub) => sum + computePendingBalance(sub), 0)
  );

  res.json({
    status: 'success',
    data: {
      todaysCollection: roundCurrency(todaysCollection),
      thisMonth: roundCurrency(thisMonth),
      totalRecords,
      totalPending,
    },
  });
});

export const updateSubscription = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const validated = updateSubscriptionSchema.parse(req.body);
  const { status, paymentStatus, paymentMethod, startDate, planId, balanceAmount } = validated;

  const currentSub = await prisma.subscription.findUnique({
    where: { id },
    include: { plan: true, invoice: { include: { payments: true } } },
  });
  if (!currentSub) {
    throw new NotFoundError('Subscription not found');
  }

  const effectivePlanId = planId || currentSub.planId;
  const effectivePlan = planId
    ? await prisma.membershipPlan.findUnique({ where: { id: planId } })
    : currentSub.plan;
  if (!effectivePlan) {
    throw new NotFoundError('Plan not found');
  }

  const effectivePaymentStatus = paymentStatus ?? (currentSub.paymentStatus as 'PAID' | 'PENDING');
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
      const breakdown = computeInvoiceBreakdown(
        effectivePlan.price,
        effectivePlan.gstPercentage,
        effectivePaymentStatus as 'PAID' | 'PENDING',
        effectiveBalance
      );

      await tx.invoice.update({
        where: { id: currentSub.invoice.id },
        data: {
          subtotal: breakdown.subtotal,
          gstAmount: breakdown.gstAmount,
          totalAmount: breakdown.totalAmount,
          status: breakdown.invoiceStatus,
        },
      });

      const totalPaidSoFar = currentSub.invoice.payments.reduce((acc, p) => acc + p.amount, 0);
      if (breakdown.paidAmount > totalPaidSoFar) {
        await tx.payment.create({
          data: {
            invoiceId: currentSub.invoice.id,
            amount: roundCurrency(breakdown.paidAmount - totalPaidSoFar),
            method: effectiveMethod,
            status: 'COMPLETED',
            notes: 'Subscription payment update',
          },
        });
      }
    }

    return updatedSub;
  });

  invalidateCacheScopes('dashboard', 'reports', 'members');
  res.json({ status: 'success', data: updated });
});

export const deleteSubscription = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const sub = await prisma.subscription.findUnique({
    where: { id },
    include: { invoice: { select: { id: true } } },
  });
  if (!sub) {
    throw new NotFoundError('Subscription not found');
  }

  await prisma.$transaction(async (tx) => {
    if (sub.invoice) {
      await tx.payment.deleteMany({ where: { invoiceId: sub.invoice.id } });
      await tx.invoice.delete({ where: { id: sub.invoice.id } });
    }
    await tx.subscription.delete({ where: { id } });
  });

  invalidateCacheScopes('dashboard', 'reports', 'members');
  res.json({ status: 'success', message: 'Subscription deleted successfully' });
});
