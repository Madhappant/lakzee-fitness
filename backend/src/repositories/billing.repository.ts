/* eslint-disable @typescript-eslint/no-explicit-any */
import { PrismaClient } from '@prisma/client';
import { prisma } from '../config/prisma';
import { buildBranchWhere, PRIMARY_BRANCH_ID } from '../utils/tenant';

export class BillingRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  // --- Membership Plans ---
  createPlan(data: any) {
    return this.db.membershipPlan.create({
      data: {
        ...data,
        branchId: data.branchId ?? PRIMARY_BRANCH_ID,
      },
    });
  }

  listActivePlans(branchId?: string | null) {
    return this.db.membershipPlan.findMany({
      where: { isActive: true, ...buildBranchWhere(branchId) },
      orderBy: { price: 'asc' },
    });
  }

  listActivePlanNames(branchId?: string | null) {
    return this.db.membershipPlan.findMany({
      where: { isActive: true, ...buildBranchWhere(branchId) },
      select: { id: true, name: true, branchId: true },
    });
  }

  findPlanById(id: string) {
    return this.db.membershipPlan.findUnique({ where: { id } });
  }

  updatePlan(id: string, data: any) {
    return this.db.membershipPlan.update({ where: { id }, data });
  }

  deactivatePlan(id: string) {
    return this.db.membershipPlan.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // --- Subscriptions, Invoices & Payments ---
  expireOverdueActiveSubscriptions(todayMidnight: Date, branchId?: string | null) {
    return this.db.subscription.updateMany({
      where: {
        status: 'ACTIVE',
        endDate: { lt: todayMidnight },
        ...buildBranchWhere(branchId),
      },
      data: { status: 'EXPIRED' },
    });
  }

  findSubscriptionCreateContext(memberProfileId: string, planId: string) {
    return Promise.all([
      this.db.memberProfile.findUnique({
        where: { id: memberProfileId },
        select: { id: true, branchId: true },
      }),
      this.db.membershipPlan.findUnique({
        where: { id: planId },
        select: {
          id: true,
          branchId: true,
          name: true,
          price: true,
          durationDays: true,
          gstPercentage: true,
        },
      }),
    ]);
  }

  createSubscriptionLedgerTransaction(input: {
    branchId?: string;
    memberId: string;
    planId: string;
    startDate: Date;
    endDate: Date;
    status: string;
    paymentStatus: string;
    paymentMethod: string;
    balanceAmount: number;
    invoiceNumber: string;
    subtotal: number;
    gstAmount: number;
    totalAmount: number;
    invoiceStatus: string;
    paidAmount: number;
  }) {
    const resolvedBranchId = input.branchId ?? PRIMARY_BRANCH_ID;
    return this.db.$transaction(async (tx) => {
      const sub = await tx.subscription.create({
        data: {
          branchId: resolvedBranchId,
          memberId: input.memberId,
          planId: input.planId,
          startDate: input.startDate,
          endDate: input.endDate,
          status: input.status,
          paymentStatus: input.paymentStatus,
          paymentMethod: input.paymentMethod,
          balanceAmount: input.balanceAmount,
        },
        include: { plan: true },
      });

      const invoice = await tx.invoice.create({
        data: {
          branchId: resolvedBranchId,
          invoiceNumber: input.invoiceNumber,
          memberId: input.memberId,
          subscriptionId: sub.id,
          subtotal: input.subtotal,
          gstAmount: input.gstAmount,
          totalAmount: input.totalAmount,
          status: input.invoiceStatus,
        },
      });

      if (input.paidAmount > 0) {
        await tx.payment.create({
          data: {
            branchId: resolvedBranchId,
            invoiceId: invoice.id,
            memberId: input.memberId,
            planId: input.planId,
            amount: input.paidAmount,
            amountInPaise: Math.round(input.paidAmount * 100),
            currency: 'INR',
            method: input.paymentMethod,
            invoiceNumber: input.invoiceNumber,
            previousExpiryDate: null,
            newExpiryDate: input.endDate,
            paidAt: new Date(),
            status: 'COMPLETED',
            notes: input.paymentStatus === 'PENDING' ? 'Partial upfront payment' : 'Initial subscription payment',
          },
        });
      }

      return sub;
    });
  }

  listSubscriptions(where: any) {
    return this.db.subscription.findMany({
      where,
      include: {
        plan: true,
        member: {
          select: {
            id: true,
            branchId: true,
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
  }

  findPaymentStatsInputs(firstDayOfMonth: Date, branchId?: string | null) {
    const branchWhere = buildBranchWhere(branchId);
    return Promise.all([
      this.db.subscription.findMany({
        where: { createdAt: { gte: firstDayOfMonth }, ...branchWhere },
        select: {
          createdAt: true,
          paymentStatus: true,
          balanceAmount: true,
          plan: { select: { price: true } },
        },
      }),
      this.db.subscription.count({
        ...(branchId ? { where: branchWhere } : {}),
      }),
      this.db.subscription.findMany({
        where: { paymentStatus: 'PENDING', ...branchWhere },
        select: {
          paymentStatus: true,
          balanceAmount: true,
          plan: { select: { price: true } },
        },
      }),
    ]);
  }

  findSubscriptionWithLedger(id: string) {
    return this.db.subscription.findUnique({
      where: { id },
      include: {
        plan: true,
        member: { select: { id: true, branchId: true } },
        invoice: { include: { payments: true } },
      },
    });
  }

  updateSubscriptionLedgerTransaction(input: {
    id: string;
    branchId?: string;
    dataToUpdate: Record<string, any>;
    invoiceId?: string;
    invoiceUpdate?: {
      subtotal: number;
      gstAmount: number;
      totalAmount: number;
      status: string;
    };
    incrementalPayment?: {
      amount: number;
      method: string;
    };
  }) {
    return this.db.$transaction(async (tx) => {
      const updatedSub = await tx.subscription.update({
        where: { id: input.id },
        data: input.dataToUpdate,
      });

      if (input.invoiceId && input.invoiceUpdate) {
        await tx.invoice.update({
          where: { id: input.invoiceId },
          data: input.invoiceUpdate,
        });

        if (input.incrementalPayment && input.incrementalPayment.amount > 0) {
          await tx.payment.create({
            data: {
              branchId: input.branchId ?? updatedSub.branchId ?? PRIMARY_BRANCH_ID,
              invoiceId: input.invoiceId,
              amount: input.incrementalPayment.amount,
              method: input.incrementalPayment.method,
              status: 'COMPLETED',
              notes: 'Subscription payment update',
            },
          });
        }
      }

      return updatedSub;
    });
  }

  deleteSubscriptionCascade(id: string, invoiceId?: string) {
    return this.db.$transaction(async (tx) => {
      if (invoiceId) {
        await tx.payment.deleteMany({ where: { invoiceId } });
        await tx.invoice.delete({ where: { id: invoiceId } });
      }
      await tx.subscription.delete({ where: { id } });
    });
  }

  // --- Studio Expenses ---
  findExpenseById(id: string) {
    return this.db.expense.findUnique({ where: { id } });
  }

  createExpense(data: {
    branchId?: string;
    title: string;
    category: string;
    amount: number;
    date: Date;
    paymentMethod: string;
    notes?: string;
  }) {
    return this.db.expense.create({
      data: {
        ...data,
        branchId: data.branchId ?? PRIMARY_BRANCH_ID,
      },
    });
  }

  listExpenses(where: Record<string, any>) {
    return this.db.expense.findMany({
      where,
      orderBy: { date: 'desc' },
    });
  }

  updateExpense(id: string, data: Record<string, any>) {
    return this.db.expense.update({
      where: { id },
      data,
    });
  }

  deleteExpense(id: string) {
    return this.db.expense.delete({ where: { id } });
  }
}

export const billingRepository = new BillingRepository();
