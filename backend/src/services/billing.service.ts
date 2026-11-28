/* eslint-disable @typescript-eslint/no-explicit-any */
import { BillingRepository, billingRepository } from '../repositories/billing.repository';
import { CACHE_KEYS, invalidateTenantCacheScopes, memoryCache } from '../utils/cache';
import { BadRequestError, NotFoundError } from '../utils/errors';
import {
  assertBranchOwnership,
  buildBranchWhere,
  PRIMARY_BRANCH_ID,
  scopedCacheKey,
  type TenantScope,
} from '../utils/tenant';
import {
  computeCollectedAmount,
  computeInvoiceBreakdown,
  computePendingBalance,
  createSubscriptionWithRepository,
  roundCurrency,
  syncExpiredWithRepository,
  type CreateSubscriptionInput,
} from './subscription-ledger.service';

const PLANS_CACHE_TTL_SECONDS = 300;

export class BillingService {
  constructor(private readonly repo: BillingRepository = billingRepository) {}

  // --- Plans ---
  async listActivePlans(branchId?: string | null) {
    const cacheKey = scopedCacheKey(CACHE_KEYS.MEMBERSHIP_PLANS, branchId);
    const cached = await memoryCache.getDistributed<any[]>(cacheKey, PLANS_CACHE_TTL_SECONDS);
    if (cached) {
      return { plans: cached, cached: true };
    }

    const plans = await this.repo.listActivePlans(branchId);
    memoryCache.set(cacheKey, plans, PLANS_CACHE_TTL_SECONDS);
    return { plans, cached: false };
  }

  async createPlan(data: any) {
    const branchId = data.branchId ?? PRIMARY_BRANCH_ID;
    const price = Number(data.price);
    const gstPercentage = Number(data.gstPercentage ?? 18.0);
    const plan = await this.repo.createPlan({
      ...data,
      branchId,
      price,
      priceInPaise: Math.round(price * 100),
      gstPercentage,
      taxPercent: gstPercentage,
    });
    invalidateTenantCacheScopes(branchId, 'plans', 'dashboard', 'reports', 'members');
    return plan;
  }

  async updatePlan(id: string, data: any, tenant?: TenantScope) {
    const existing = await this.repo.findPlanById(id);
    if (!existing) throw new NotFoundError('Plan not found');
    const branchId = (existing as { branchId?: string | null }).branchId ?? PRIMARY_BRANCH_ID;
    assertBranchOwnership(branchId, tenant);

    const payload = { ...data };
    if (typeof data.price === 'number') {
      payload.priceInPaise = Math.round(data.price * 100);
    }
    if (typeof data.gstPercentage === 'number') {
      payload.taxPercent = data.gstPercentage;
    }

    const plan = await this.repo.updatePlan(id, payload);
    invalidateTenantCacheScopes(branchId, 'plans', 'dashboard', 'reports', 'members');
    return plan;
  }

  async deletePlan(id: string, tenant?: TenantScope) {
    const existing = await this.repo.findPlanById(id);
    if (!existing) throw new NotFoundError('Plan not found');
    const branchId = (existing as { branchId?: string | null }).branchId ?? PRIMARY_BRANCH_ID;
    assertBranchOwnership(branchId, tenant);

    await this.repo.deactivatePlan(id);
    invalidateTenantCacheScopes(branchId, 'plans', 'dashboard', 'reports', 'members');
  }

  // --- Subscriptions & Payments ---
  async createSubscription(input: CreateSubscriptionInput, tenant?: TenantScope) {
    const { subscription } = await createSubscriptionWithRepository(this.repo, input, tenant);
    return subscription;
  }

  async listSubscriptions(
    filters: { search?: unknown; status?: unknown; paymentStatus?: unknown },
    branchId?: string | null
  ) {
    await syncExpiredWithRepository(this.repo, 300, branchId);

    const andFilters: Record<string, any>[] = [];
    const branchFilter = buildBranchWhere(branchId);
    if (Object.keys(branchFilter).length > 0) {
      andFilters.push(branchFilter);
    }

    const where: Record<string, any> = {};
    if (filters.status && filters.status !== 'All Status' && filters.status !== 'ALL') {
      where.status = String(filters.status).toUpperCase();
    }
    if (filters.paymentStatus && filters.paymentStatus !== 'All Payments' && filters.paymentStatus !== 'ALL') {
      where.paymentStatus = String(filters.paymentStatus).toUpperCase();
    }
    if (filters.search) {
      const searchStr = String(filters.search).trim();
      andFilters.push({
        OR: [
          { member: { memberId: { contains: searchStr, mode: 'insensitive' } } },
          { member: { user: { firstName: { contains: searchStr, mode: 'insensitive' } } } },
          { member: { user: { lastName: { contains: searchStr, mode: 'insensitive' } } } },
          { member: { user: { email: { contains: searchStr, mode: 'insensitive' } } } },
          { member: { user: { phone: { contains: searchStr, mode: 'insensitive' } } } },
          { plan: { name: { contains: searchStr, mode: 'insensitive' } } },
        ],
      });
    }
    if (andFilters.length > 0) {
      where.AND = andFilters;
    }

    return this.repo.listSubscriptions(where);
  }

  async getPaymentStats(branchId?: string | null) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [monthSubs, totalRecords, pendingSubs] = await this.repo.findPaymentStatsInputs(
      firstDayOfMonth,
      branchId
    );

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

    return {
      todaysCollection: roundCurrency(todaysCollection),
      thisMonth: roundCurrency(thisMonth),
      totalRecords,
      totalPending,
    };
  }

  async updateSubscription(
    id: string,
    input: {
      status?: string;
      paymentStatus?: 'PAID' | 'PENDING';
      paymentMethod?: string;
      startDate?: string;
      planId?: string;
      balanceAmount?: number;
    },
    tenant?: TenantScope
  ) {
    const currentSub = await this.repo.findSubscriptionWithLedger(id);
    if (!currentSub) {
      throw new NotFoundError('Subscription not found');
    }

    const subBranchId =
      (currentSub as { branchId?: string | null }).branchId ??
      (currentSub as { member?: { branchId?: string | null } }).member?.branchId ??
      PRIMARY_BRANCH_ID;
    assertBranchOwnership(subBranchId, tenant);

    const effectivePlanId = input.planId || currentSub.planId;
    const effectivePlan = input.planId ? await this.repo.findPlanById(input.planId) : currentSub.plan;
    if (!effectivePlan) {
      throw new NotFoundError('Plan not found');
    }

    const effectivePaymentStatus = input.paymentStatus ?? (currentSub.paymentStatus as 'PAID' | 'PENDING');
    const effectiveMethod = input.paymentMethod ?? currentSub.paymentMethod;
    const effectiveBalance =
      effectivePaymentStatus === 'PAID'
        ? 0
        : roundCurrency(input.balanceAmount !== undefined ? input.balanceAmount : currentSub.balanceAmount);

    const dataToUpdate: Record<string, any> = {
      ...(input.status !== undefined && { status: input.status }),
      paymentStatus: effectivePaymentStatus,
      paymentMethod: effectiveMethod,
      balanceAmount: effectiveBalance,
    };

    if (input.startDate || input.planId) {
      const start = input.startDate ? new Date(input.startDate) : new Date(currentSub.startDate);
      const end = new Date(start);
      end.setDate(end.getDate() + effectivePlan.durationDays);
      dataToUpdate.startDate = start;
      dataToUpdate.endDate = end;
      dataToUpdate.planId = effectivePlanId;
    }

    let invoiceUpdate:
      | { subtotal: number; gstAmount: number; totalAmount: number; status: string }
      | undefined;
    let incrementalPayment: { amount: number; method: string } | undefined;

    if (currentSub.invoice) {
      const breakdown = computeInvoiceBreakdown(
        effectivePlan.price,
        effectivePlan.gstPercentage,
        effectivePaymentStatus,
        effectiveBalance
      );
      invoiceUpdate = {
        subtotal: breakdown.subtotal,
        gstAmount: breakdown.gstAmount,
        totalAmount: breakdown.totalAmount,
        status: breakdown.invoiceStatus,
      };
      const totalPaidSoFar = currentSub.invoice.payments.reduce((acc, p) => acc + p.amount, 0);
      if (breakdown.paidAmount > totalPaidSoFar) {
        incrementalPayment = {
          amount: roundCurrency(breakdown.paidAmount - totalPaidSoFar),
          method: effectiveMethod,
        };
      }
    }

    const updated = await this.repo.updateSubscriptionLedgerTransaction({
      id,
      branchId: subBranchId,
      dataToUpdate,
      invoiceId: currentSub.invoice?.id,
      invoiceUpdate,
      incrementalPayment,
    });

    invalidateTenantCacheScopes(subBranchId, 'dashboard', 'reports', 'members');
    return updated;
  }

  async deleteSubscription(id: string, tenant?: TenantScope) {
    const sub = await this.repo.findSubscriptionWithLedger(id);
    if (!sub) {
      throw new NotFoundError('Subscription not found');
    }

    const subBranchId =
      (sub as { branchId?: string | null }).branchId ??
      (sub as { member?: { branchId?: string | null } }).member?.branchId ??
      PRIMARY_BRANCH_ID;
    assertBranchOwnership(subBranchId, tenant);

    await this.repo.deleteSubscriptionCascade(id, sub.invoice?.id);
    invalidateTenantCacheScopes(subBranchId, 'dashboard', 'reports', 'members');
  }

  // --- Studio Expenses ---
  createExpense(input: {
    branchId?: string;
    title: string;
    category: string;
    amount: number;
    date?: string;
    paymentMethod: string;
    notes?: string;
  }) {
    return this.repo.createExpense({
      branchId: input.branchId ?? PRIMARY_BRANCH_ID,
      title: input.title,
      category: input.category,
      amount: roundCurrency(input.amount),
      date: input.date ? new Date(input.date) : new Date(),
      paymentMethod: input.paymentMethod,
      notes: input.notes,
    });
  }

  listExpenses(monthParam?: unknown, yearParam?: unknown, branchId?: string | null) {
    const whereClause: Record<string, any> = {
      ...buildBranchWhere(branchId),
    };
    if (monthParam && yearParam) {
      const m = Number(monthParam);
      const y = Number(yearParam);
      if (isNaN(m) || isNaN(y) || m < 1 || m > 12 || y < 2000 || y > 2100) {
        throw new BadRequestError('Invalid month or year parameter');
      }
      whereClause.date = {
        gte: new Date(y, m - 1, 1),
        lte: new Date(y, m, 0, 23, 59, 59, 999),
      };
    }
    return this.repo.listExpenses(whereClause);
  }

  async updateExpense(
    id: string,
    input: {
      title?: string;
      category?: string;
      amount?: number;
      date?: string;
      paymentMethod?: string;
      notes?: string;
    },
    tenant?: TenantScope
  ) {
    const existing = await this.repo.findExpenseById(id);
    if (!existing) throw new NotFoundError('Expense not found');
    assertBranchOwnership((existing as { branchId?: string | null }).branchId, tenant);

    return this.repo.updateExpense(id, {
      ...(input.title !== undefined && { title: input.title }),
      ...(input.category !== undefined && { category: input.category }),
      ...(input.amount !== undefined && { amount: roundCurrency(input.amount) }),
      ...(input.date !== undefined && { date: input.date ? new Date(input.date) : new Date() }),
      ...(input.paymentMethod !== undefined && { paymentMethod: input.paymentMethod }),
      ...(input.notes !== undefined && { notes: input.notes }),
    });
  }

  async deleteExpense(id: string, tenant?: TenantScope) {
    const existing = await this.repo.findExpenseById(id);
    if (!existing) throw new NotFoundError('Expense not found');
    assertBranchOwnership((existing as { branchId?: string | null }).branchId, tenant);

    return this.repo.deleteExpense(id);
  }
}

export const billingService = new BillingService();
