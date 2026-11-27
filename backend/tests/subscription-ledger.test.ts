import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  roundCurrency,
  computeCollectedAmount,
  computePendingBalance,
  computeInvoiceBreakdown,
} from '../src/services/subscription-ledger.service';
import {
  SimpleMemoryCache,
  CACHE_KEYS,
  memoryCache,
  invalidateCacheScopes,
} from '../src/utils/cache';

describe('subscription-ledger financial calculations', () => {
  it('roundCurrency rounds floating-point values cleanly to 2 decimal places', () => {
    assert.equal(roundCurrency(100.005), 100.01);
    assert.equal(roundCurrency(199.994), 199.99);
    assert.equal(roundCurrency(0.1 + 0.2), 0.3);
  });

  it('computeCollectedAmount derives paid revenue accurately across PAID and partial PENDING subscriptions', () => {
    assert.equal(
      computeCollectedAmount({ paymentStatus: 'PAID', balanceAmount: 0, plan: { price: 1500 } }),
      1500
    );
    assert.equal(
      computeCollectedAmount({ paymentStatus: 'PENDING', balanceAmount: 500, plan: { price: 1500 } }),
      1000
    );
    // Fully unpaid pending subscription (balanceAmount === 0 means full balance due)
    assert.equal(
      computeCollectedAmount({ paymentStatus: 'PENDING', balanceAmount: 0, plan: { price: 1500 } }),
      0
    );
    // Clamps collected amount at 0 if recorded balance exceeds plan price
    assert.equal(
      computeCollectedAmount({ paymentStatus: 'PENDING', balanceAmount: 2000, plan: { price: 1500 } }),
      0
    );
    assert.equal(computeCollectedAmount({ paymentStatus: 'PAID', balanceAmount: 0, plan: null }), 0);
  });

  it('computePendingBalance calculates due balance without inflating settled invoices', () => {
    assert.equal(
      computePendingBalance({ paymentStatus: 'PAID', balanceAmount: 400, plan: { price: 1500 } }),
      0
    );
    assert.equal(
      computePendingBalance({ paymentStatus: 'PENDING', balanceAmount: 650.5, plan: { price: 1500 } }),
      650.5
    );
    assert.equal(
      computePendingBalance({ paymentStatus: 'PENDING', balanceAmount: 0, plan: { price: 1500 } }),
      1500
    );
  });

  it('computeInvoiceBreakdown splits tax-inclusive price into subtotal + GST and respects balance', () => {
    const paid = computeInvoiceBreakdown(1180, 18, 'PAID', 500);
    assert.deepEqual(paid, {
      subtotal: 1000,
      gstAmount: 180,
      totalAmount: 1180,
      invoiceStatus: 'COMPLETED',
      paidAmount: 1180,
      effectiveBalance: 0,
    });

    const partial = computeInvoiceBreakdown(1180, 18, 'PENDING', 400);
    assert.deepEqual(partial, {
      subtotal: 1000,
      gstAmount: 180,
      totalAmount: 1180,
      invoiceStatus: 'PENDING',
      paidAmount: 780,
      effectiveBalance: 400,
    });

    const negativeClamp = computeInvoiceBreakdown(1180, 18, 'PENDING', -250);
    assert.equal(negativeClamp.effectiveBalance, 0);
    assert.equal(negativeClamp.paidAmount, 1180);
  });
});

describe('SimpleMemoryCache LRU, TTL & scope invalidation', () => {
  it('expires entries based on TTL without holding timers', (t) => {
    let fakeNow = 1_000_000;
    t.mock.method(Date, 'now', () => fakeNow);

    const cache = new SimpleMemoryCache(5);
    cache.set('k1', 'val1', 10); // expires at 1_010_000
    cache.set('k0', 'ignored', 0);

    assert.equal(cache.get('k0'), null);
    assert.equal(cache.get('k1'), 'val1');

    fakeNow = 1_010_001;
    assert.equal(cache.get('k1'), null);
    assert.equal(cache.size(), 0);
  });

  it('evicts the least-recently-used key when maxEntries is exceeded', () => {
    const cache = new SimpleMemoryCache(2);
    cache.set('a', 1, 60);
    cache.set('b', 2, 60);
    // Touch 'a' so 'b' becomes LRU
    assert.equal(cache.get('a'), 1);

    cache.set('c', 3, 60);
    assert.equal(cache.get('b'), null);
    assert.equal(cache.get('a'), 1);
    assert.equal(cache.get('c'), 3);
  });

  it('deletePrefix and invalidateCacheScopes clear targeted entries without wiping unrelated keys', () => {
    memoryCache.clear();
    memoryCache.set(CACHE_KEYS.DASHBOARD_STATS, { ok: 1 }, 60);
    memoryCache.set(CACHE_KEYS.REPORTS_OVERVIEW, { ok: 2 }, 60);
    memoryCache.set(CACHE_KEYS.MEMBERSHIP_PLANS, ['plan'], 60);
    memoryCache.set(`${CACHE_KEYS.AUTH_USER_PREFIX}u1`, { id: 'u1', role: 'ADMIN' }, 60);

    invalidateCacheScopes('dashboard', 'auth:u1');

    assert.equal(memoryCache.get(CACHE_KEYS.DASHBOARD_STATS), null);
    assert.equal(memoryCache.get(`${CACHE_KEYS.AUTH_USER_PREFIX}u1`), null);
    assert.deepEqual(memoryCache.get(CACHE_KEYS.REPORTS_OVERVIEW), { ok: 2 });
    assert.deepEqual(memoryCache.get(CACHE_KEYS.MEMBERSHIP_PLANS), ['plan']);

    memoryCache.clear();
  });
});
