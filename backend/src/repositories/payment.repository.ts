/* eslint-disable @typescript-eslint/no-explicit-any */
import { PrismaClient } from '@prisma/client';
import { prisma } from '../config/prisma';
import { NotFoundError } from '../utils/errors';
import { buildBranchWhere, PRIMARY_BRANCH_ID } from '../utils/tenant';
import { computeInvoiceBreakdown, roundCurrency } from '../services/subscription-ledger.service';

export function computeExtendedExpiryDates(params: {
  latestSubscription: { status?: string | null; endDate: Date | string } | null;
  durationDays: number;
  now?: Date;
}): { previousExpiryDate: Date | null; newExpiryDate: Date; baseDateUsed: Date } {
  const now = params.now ? new Date(params.now) : new Date();
  const prevEnd = params.latestSubscription ? new Date(params.latestSubscription.endDate) : null;
  const isCurrentlyActive =
    Boolean(prevEnd) &&
    prevEnd!.getTime() > now.getTime() &&
    params.latestSubscription?.status !== 'CANCELLED';
  const baseDateUsed = isCurrentlyActive ? prevEnd! : now;
  const newExpiryDate = new Date(baseDateUsed.getTime() + params.durationDays * 86_400_000);
  return {
    previousExpiryDate: prevEnd,
    newExpiryDate,
    baseDateUsed,
  };
}

export class PaymentRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  findMemberByUserId(userId: string) {
    return this.db.memberProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            branchId: true,
          },
        },
        branch: true,
      },
    });
  }

  async findMemberByIdentifier(identifier: string, branchId?: string | null) {
    const direct = await this.db.memberProfile.findUnique({
      where: { id: identifier },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            branchId: true,
          },
        },
        branch: true,
      },
    });
    if (direct) return direct;

    const byUserId = await this.db.memberProfile.findUnique({
      where: { userId: identifier },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            branchId: true,
          },
        },
        branch: true,
      },
    });
    if (byUserId) return byUserId;

    return this.db.memberProfile.findFirst({
      where: {
        memberId: identifier,
        ...buildBranchWhere(branchId),
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            branchId: true,
          },
        },
        branch: true,
      },
    });
  }

  findPlanById(planId: string) {
    return this.db.membershipPlan.findUnique({ where: { id: planId } });
  }

  listActivePlans(branchId?: string | null) {
    return this.db.membershipPlan.findMany({
      where: { isActive: true, ...buildBranchWhere(branchId) },
      orderBy: { price: 'asc' },
    });
  }

  findLatestMemberSubscription(memberProfileId: string) {
    return this.db.subscription.findFirst({
      where: { memberId: memberProfileId },
      orderBy: { endDate: 'desc' },
      include: { plan: true },
    });
  }

  findBranchById(branchId: string) {
    return this.db.branch.findUnique({ where: { id: branchId } });
  }

  findBranchSettings(branchId?: string | null) {
    return this.db.settings.findFirst({
      where: branchId ? buildBranchWhere(branchId) : undefined,
    });
  }

  findPaymentById(id: string) {
    return this.db.payment.findUnique({
      where: { id },
      include: {
        member: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
              },
            },
          },
        },
        plan: true,
        invoice: true,
        branch: true,
      },
    });
  }

  findPaymentByOrderId(razorpayOrderId: string) {
    return this.db.payment.findUnique({
      where: { razorpayOrderId },
      include: {
        member: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
              },
            },
          },
        },
        plan: true,
        invoice: true,
        branch: true,
      },
    });
  }

  createOrderRecord(data: {
    branchId: string;
    memberId: string;
    planId: string;
    amount: number;
    amountInPaise: number;
    currency: string;
    razorpayOrderId: string;
    notes?: string;
  }) {
    return this.db.payment.create({
      data: {
        branchId: data.branchId,
        memberId: data.memberId,
        planId: data.planId,
        amount: data.amount,
        amountInPaise: data.amountInPaise,
        currency: data.currency,
        method: 'upi',
        razorpayOrderId: data.razorpayOrderId,
        status: 'CREATED',
        notes: data.notes ?? null,
      },
    });
  }

  listPayments(filters: {
    branchId?: string | null;
    memberId?: string;
    status?: string;
    method?: string;
    limit?: number;
  }) {
    const where: Record<string, any> = {
      ...buildBranchWhere(filters.branchId),
    };
    if (filters.memberId) where.memberId = filters.memberId;
    if (filters.status && filters.status !== 'ALL') where.status = filters.status;
    if (filters.method && filters.method !== 'ALL') where.method = filters.method;

    return this.db.payment.findMany({
      where,
      take: filters.limit ?? 100,
      orderBy: { paymentDate: 'desc' },
      include: {
        member: {
          include: {
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
        plan: true,
        invoice: true,
        branch: true,
      },
    });
  }

  async markPaymentFailed(params: {
    razorpayOrderId: string;
    razorpayPaymentId?: string | null;
    method?: string | null;
    failureReason?: string | null;
  }) {
    const existing = await this.findPaymentByOrderId(params.razorpayOrderId);
    if (!existing) return null;
    if (existing.status === 'CAPTURED' || existing.status === 'COMPLETED') {
      return existing;
    }

    return this.db.payment.update({
      where: { id: existing.id },
      data: {
        status: 'FAILED',
        ...(params.razorpayPaymentId ? { razorpayPaymentId: params.razorpayPaymentId } : {}),
        ...(params.method ? { method: params.method } : {}),
        failureReason: params.failureReason?.slice(0, 300) || 'Payment failed at gateway',
      },
    });
  }

  /**
   * Executes strict idempotent capture + membership validity extension + GST invoice generation
   * inside a single atomic database transaction.
   */
  async capturePaymentAndExtendAtomic(input: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature?: string | null;
    method: string;
    paidAt?: Date;
  }): Promise<{
    alreadyCaptured: boolean;
    payment: any;
    subscription: any | null;
    invoice: any | null;
  }> {
    const now = input.paidAt ?? new Date();

    try {
      return await this.db.$transaction(async (tx) => {
        const existing = await tx.payment.findUnique({
          where: { razorpayOrderId: input.razorpayOrderId },
          include: {
            member: {
              include: {
                user: {
                  select: { id: true, email: true, firstName: true, lastName: true, phone: true },
                },
              },
            },
            plan: true,
            invoice: true,
            branch: true,
          },
        });

        if (!existing) {
          throw new NotFoundError('Payment order not found');
        }

        if (existing.status === 'CAPTURED' || existing.status === 'COMPLETED') {
          return {
            alreadyCaptured: true,
            payment: existing,
            subscription: null,
            invoice: existing.invoice ?? null,
          };
        }

        const existingByPaymentId = await tx.payment.findUnique({
          where: { razorpayPaymentId: input.razorpayPaymentId },
          include: {
            member: {
              include: {
                user: {
                  select: { id: true, email: true, firstName: true, lastName: true, phone: true },
                },
              },
            },
            plan: true,
            invoice: true,
            branch: true,
          },
        });
        if (existingByPaymentId && existingByPaymentId.status === 'CAPTURED') {
          return {
            alreadyCaptured: true,
            payment: existingByPaymentId,
            subscription: null,
            invoice: existingByPaymentId.invoice ?? null,
          };
        }

        if (!existing.memberId || !existing.planId || !existing.plan) {
          throw new NotFoundError('Payment order is missing member or plan reference');
        }

        const resolvedBranchId = existing.branchId ?? existing.member?.branchId ?? PRIMARY_BRANCH_ID;
        const latestSub = await tx.subscription.findFirst({
          where: { memberId: existing.memberId },
          orderBy: { endDate: 'desc' },
        });

        const { previousExpiryDate, newExpiryDate } = computeExtendedExpiryDates({
          latestSubscription: latestSub,
          durationDays: existing.plan.durationDays,
          now,
        });

        // Generate sequential branch invoice number (e.g., INV-BR001-2026-0001)
        const branch = await tx.branch.findUnique({ where: { id: resolvedBranchId } });
        const branchToken = ((branch as any)?.code || 'BR001').replace(/[^A-Z0-9]/gi, '').toUpperCase();
        const year = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', year: 'numeric' }).format(now);
        const prefix = `INV-${branchToken}-${year}-`;
        const priorCount = await tx.payment.count({
          where: {
            branchId: resolvedBranchId,
            invoiceNumber: { startsWith: prefix },
          },
        });

        let invoiceNumber = `${prefix}${String(priorCount + 1).padStart(4, '0')}`;
        const existingInvoiceSameNumber = await tx.invoice.findUnique({ where: { invoiceNumber } });
        if (existingInvoiceSameNumber) {
          invoiceNumber = `${prefix}${String(priorCount + 2).padStart(4, '0')}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
        }

        const totalInr = roundCurrency((existing.amountInPaise ?? Math.round(existing.amount * 100)) / 100);
        const taxRate = existing.plan.taxPercent ?? existing.plan.gstPercentage ?? 18.0;
        const breakdown = computeInvoiceBreakdown(totalInr, taxRate, 'PAID', 0);

        const subscription = await tx.subscription.create({
          data: {
            branchId: resolvedBranchId,
            memberId: existing.memberId,
            planId: existing.planId,
            startDate: now,
            endDate: newExpiryDate,
            status: 'ACTIVE',
            paymentStatus: 'PAID',
            paymentMethod: input.method.toUpperCase(),
            balanceAmount: 0,
          },
          include: { plan: true },
        });

        const invoice = await tx.invoice.create({
          data: {
            branchId: resolvedBranchId,
            invoiceNumber,
            memberId: existing.memberId,
            subscriptionId: subscription.id,
            subtotal: breakdown.subtotal,
            gstAmount: breakdown.gstAmount,
            totalAmount: breakdown.totalAmount,
            status: 'COMPLETED',
          },
        });

        const receiptUrl = `/api/payments/${existing.id}/receipt`;
        const updatedPayment = await tx.payment.update({
          where: { id: existing.id },
          data: {
            branchId: resolvedBranchId,
            invoiceId: invoice.id,
            status: 'CAPTURED',
            method: input.method.toLowerCase(),
            transactionId: input.razorpayPaymentId,
            razorpayPaymentId: input.razorpayPaymentId,
            razorpaySignature: input.razorpaySignature ?? null,
            invoiceNumber,
            receiptUrl,
            previousExpiryDate,
            newExpiryDate,
            paidAt: now,
            paymentDate: now,
            failureReason: null,
          },
        });

        return {
          alreadyCaptured: false,
          payment: {
            ...updatedPayment,
            member: existing.member,
            plan: existing.plan,
            invoice,
            branch: existing.branch ?? branch,
          },
          subscription,
          invoice,
        };
      });
    } catch (err: any) {
      // Handle rare concurrent P2002 race on unique razorpayPaymentId gracefully as idempotent hit
      if (err?.code === 'P2002') {
        const existing = await this.findPaymentByOrderId(input.razorpayOrderId);
        if (existing && (existing.status === 'CAPTURED' || existing.status === 'COMPLETED')) {
          return {
            alreadyCaptured: true,
            payment: existing,
            subscription: null,
            invoice: existing.invoice ?? null,
          };
        }
      }
      throw err;
    }
  }
}

export const paymentRepository = new PaymentRepository();
