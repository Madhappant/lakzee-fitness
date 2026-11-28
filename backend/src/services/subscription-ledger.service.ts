import { PrismaClient } from '@prisma/client';
import { BillingRepository, billingRepository } from '../repositories/billing.repository';
import { CACHE_KEYS, invalidateTenantCacheScopes, memoryCache } from '../utils/cache';
import { NotFoundError } from '../utils/errors';
import { assertBranchOwnership, PRIMARY_BRANCH_ID, scopedCacheKey, type TenantScope } from '../utils/tenant';

export type PaymentStatus = 'PAID' | 'PENDING' | string;

export interface SubscriptionFinancialShape {
  paymentStatus: PaymentStatus;
  balanceAmount: number;
  plan?: { price: number } | null;
}

export const roundCurrency = (val: number): number => Math.round(val * 100) / 100;

export function computeCollectedAmount(sub: SubscriptionFinancialShape): number {
  const price = sub.plan?.price || 0;
  if (sub.paymentStatus === 'PAID') return roundCurrency(price);
  if (sub.paymentStatus === 'PENDING' && sub.balanceAmount > 0) {
    return roundCurrency(Math.max(0, price - sub.balanceAmount));
  }
  return 0;
}

export function computePendingBalance(sub: SubscriptionFinancialShape): number {
  if (sub.paymentStatus !== 'PENDING') return 0;
  const price = sub.plan?.price || 0;
  return roundCurrency(sub.balanceAmount > 0 ? sub.balanceAmount : price);
}

export interface InvoiceBreakdown {
  subtotal: number;
  gstAmount: number;
  totalAmount: number;
  invoiceStatus: 'COMPLETED' | 'PENDING';
  paidAmount: number;
  effectiveBalance: number;
}

export function computeInvoiceBreakdown(
  planPrice: number,
  gstPercentage: number,
  paymentStatus: 'PAID' | 'PENDING',
  balanceAmount = 0
): InvoiceBreakdown {
  const effectiveBalance = paymentStatus === 'PAID' ? 0 : Math.max(0, roundCurrency(balanceAmount));
  const gstRate = (gstPercentage || 18.0) / 100;
  const basePrice = planPrice / (1 + gstRate);
  const gstAmount = planPrice - basePrice;
  const paidAmount =
    paymentStatus === 'PAID'
      ? roundCurrency(planPrice)
      : Math.max(0, roundCurrency(planPrice - effectiveBalance));

  return {
    subtotal: roundCurrency(basePrice),
    gstAmount: roundCurrency(gstAmount),
    totalAmount: roundCurrency(planPrice),
    invoiceStatus: paymentStatus === 'PAID' ? 'COMPLETED' : 'PENDING',
    paidAmount,
    effectiveBalance,
  };
}

export interface CreateSubscriptionInput {
  memberId: string;
  planId: string;
  startDate: Date | string;
  branchId?: string;
  status?: 'ACTIVE' | 'EXPIRED' | 'FROZEN' | 'CANCELLED';
  paymentStatus?: 'PAID' | 'PENDING';
  paymentMethod?: 'CASH' | 'UPI' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'BANK_TRANSFER' | 'SPLIT';
  balanceAmount?: number;
}

export async function createSubscriptionWithRepository(
  repo: BillingRepository,
  input: CreateSubscriptionInput,
  tenant?: TenantScope
) {
  const paymentStatus = input.paymentStatus ?? 'PAID';
  const paymentMethod = input.paymentMethod ?? 'CASH';

  const [member, plan] = await repo.findSubscriptionCreateContext(input.memberId, input.planId);
  if (!member) throw new NotFoundError('Member not found');
  if (!plan) throw new NotFoundError('Plan not found');

  const resolvedBranchId =
    (member as { branchId?: string | null }).branchId ??
    input.branchId ??
    tenant?.branchId ??
    PRIMARY_BRANCH_ID;
  assertBranchOwnership(resolvedBranchId, tenant);

  const start = input.startDate instanceof Date ? new Date(input.startDate) : new Date(input.startDate);
  const end = new Date(start);
  end.setDate(end.getDate() + plan.durationDays);

  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);
  const computedStatus = input.status || (end < todayMidnight ? 'EXPIRED' : 'ACTIVE');

  const breakdown = computeInvoiceBreakdown(plan.price, plan.gstPercentage, paymentStatus, input.balanceAmount ?? 0);
  const invoiceNumber = `INV-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

  const subscription = await repo.createSubscriptionLedgerTransaction({
    branchId: resolvedBranchId,
    memberId: input.memberId,
    planId: input.planId,
    startDate: start,
    endDate: end,
    status: computedStatus,
    paymentStatus,
    paymentMethod,
    balanceAmount: breakdown.effectiveBalance,
    invoiceNumber,
    subtotal: breakdown.subtotal,
    gstAmount: breakdown.gstAmount,
    totalAmount: breakdown.totalAmount,
    invoiceStatus: breakdown.invoiceStatus,
    paidAmount: breakdown.paidAmount,
  });

  invalidateTenantCacheScopes(resolvedBranchId, 'dashboard', 'reports', 'members');
  return { subscription, plan, endDate: end };
}

export function createSubscriptionWithInvoice(db: PrismaClient | undefined, input: CreateSubscriptionInput) {
  const repo = db ? new BillingRepository(db) : billingRepository;
  return createSubscriptionWithRepository(repo, input);
}

/**
 * Prevents issuing an UPDATE lock on every GET /api/subscriptions call by cooling down syncs.
 */
export async function syncExpiredWithRepository(
  repo: BillingRepository,
  cooldownSeconds = 300,
  branchId?: string | null
): Promise<number> {
  const syncKey = scopedCacheKey(CACHE_KEYS.SUBSCRIPTIONS_EXPIRY_SYNC, branchId);
  const recentlySynced = memoryCache.get<boolean>(syncKey);
  if (recentlySynced) return 0;

  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);

  const result = await repo.expireOverdueActiveSubscriptions(todayMidnight, branchId);
  memoryCache.set(syncKey, true, cooldownSeconds);

  if (result.count > 0) {
    invalidateTenantCacheScopes(branchId, 'dashboard', 'reports', 'members');
  }

  return result.count;
}

export function syncExpiredSubscriptions(db: PrismaClient | undefined, cooldownSeconds = 300): Promise<number> {
  const repo = db ? new BillingRepository(db) : billingRepository;
  return syncExpiredWithRepository(repo, cooldownSeconds);
}
