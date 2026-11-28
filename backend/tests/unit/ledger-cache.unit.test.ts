import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  computeCollectedAmount,
  computeInvoiceBreakdown,
  computePendingBalance,
  roundCurrency,
} from '../../src/services/subscription-ledger.service';
import {
  CACHE_KEYS,
  invalidateCacheScopes,
  memoryCache,
  SimpleMemoryCache,
} from '../../src/utils/cache';

describe('Financial Ledger & In-Memory Read Cache', () => {
  beforeEach(() => {
    memoryCache.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('computes rounded totals, collected amounts, pending balances, and GST invoices accurately', () => {
    expect(roundCurrency(100.005)).toBe(100.01);
    expect(roundCurrency(0.1 + 0.2)).toBe(0.3);

    expect(computeCollectedAmount({ paymentStatus: 'PAID', balanceAmount: 0, plan: { price: 2500 } })).toBe(2500);
    expect(computeCollectedAmount({ paymentStatus: 'PENDING', balanceAmount: 500, plan: { price: 2500 } })).toBe(2000);
    expect(computeCollectedAmount({ paymentStatus: 'PENDING', balanceAmount: 0, plan: { price: 2500 } })).toBe(0);

    expect(computePendingBalance({ paymentStatus: 'PAID', balanceAmount: 500, plan: { price: 2500 } })).toBe(0);
    expect(computePendingBalance({ paymentStatus: 'PENDING', balanceAmount: 750, plan: { price: 2500 } })).toBe(750);
    expect(computePendingBalance({ paymentStatus: 'PENDING', balanceAmount: 0, plan: { price: 2500 } })).toBe(2500);

    expect(computeInvoiceBreakdown(1180, 18, 'PAID', 0)).toEqual({
      subtotal: 1000,
      gstAmount: 180,
      totalAmount: 1180,
      invoiceStatus: 'COMPLETED',
      paidAmount: 1180,
      effectiveBalance: 0,
    });
  });

  it('expires cached keys deterministically by TTL and evicts least-recently-used entries', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-28T00:00:00Z'));

    const cache = new SimpleMemoryCache(2);
    cache.set('k1', 'value-1', 10);
    cache.set('k2', 'value-2', 10);
    // Access k1 so k2 is LRU
    expect(cache.get('k1')).toBe('value-1');

    cache.set('k3', 'value-3', 10);
    expect(cache.get('k2')).toBeNull();
    expect(cache.get('k1')).toBe('value-1');

    vi.advanceTimersByTime(10_001);
    expect(cache.get('k1')).toBeNull();
    expect(cache.get('k3')).toBeNull();
    expect(cache.size()).toBe(0);
  });

  it('invalidates targeted member, dashboard, and report cache scopes cleanly', () => {
    memoryCache.set(`${CACHE_KEYS.MEMBERS_LIST}:asc`, ['m1'], 60);
    memoryCache.set(`${CACHE_KEYS.MEMBERS_LIST}:desc`, ['m1'], 60);
    memoryCache.set(CACHE_KEYS.DASHBOARD_STATS, { activeMembers: 1 }, 60);
    memoryCache.set(CACHE_KEYS.MEMBERSHIP_PLANS, [{ id: 'p1' }], 60);

    invalidateCacheScopes('members', 'dashboard');

    expect(memoryCache.get(`${CACHE_KEYS.MEMBERS_LIST}:asc`)).toBeNull();
    expect(memoryCache.get(`${CACHE_KEYS.MEMBERS_LIST}:desc`)).toBeNull();
    expect(memoryCache.get(CACHE_KEYS.DASHBOARD_STATS)).toBeNull();
    expect(memoryCache.get(CACHE_KEYS.MEMBERSHIP_PLANS)).toEqual([{ id: 'p1' }]);
  });
});
