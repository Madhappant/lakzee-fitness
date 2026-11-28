import { beforeEach, describe, expect, it } from 'vitest';
import {
  evaluateCheckInWindow,
  performMemberCheckIn,
  performMemberCheckOut,
} from '../../src/services/attendance.service';
import { CACHE_KEYS, memoryCache } from '../../src/utils/cache';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../src/utils/errors';
import { buildMemberPair, resetMemberFactorySequence } from '../factories/member.factory';
import { InMemoryPrismaDatabase } from '../factories/in-memory-db.factory';

describe('Attendance Window Rules & Check-In/Check-Out Service', () => {
  const now = new Date('2026-11-28T08:00:00.000Z');
  const db = new InMemoryPrismaDatabase();

  beforeEach(() => {
    memoryCache.clear();
    resetMemberFactorySequence();
    const { user, profile } = buildMemberPair({
      memberId: '001',
      firstName: 'Aarav',
      lastName: 'One',
      qrCode: 'LAKZEE-QR-001',
    });
    db.reset({
      users: [user],
      memberProfiles: [profile],
      plans: [
        {
          id: 'plan-1',
          name: 'Gold Monthly',
          description: null,
          price: 2000,
          durationDays: 30,
          gstPercentage: 0,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        },
      ],
      subscriptions: [
        {
          id: 'sub-1',
          memberId: profile.id,
          planId: 'plan-1',
          startDate: new Date('2026-11-01T00:00:00Z'),
          endDate: new Date('2026-12-30T00:00:00Z'),
          status: 'ACTIVE',
          paymentStatus: 'PAID',
          paymentMethod: 'UPI',
          balanceAmount: 0,
          createdAt: now,
          updatedAt: now,
        },
      ],
    });
  });

  it('evaluates 16-hour active check-in windows and auto-closes stale sessions', () => {
    expect(evaluateCheckInWindow(now, null)).toEqual({ action: 'ALLOW' });

    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    expect(evaluateCheckInWindow(now, { id: 'att-1', checkIn: twoHoursAgo })).toEqual({
      action: 'REJECT_ALREADY_CHECKED_IN',
    });

    const twentyHoursAgo = new Date(now.getTime() - 20 * 60 * 60 * 1000);
    expect(evaluateCheckInWindow(now, { id: 'att-stale', checkIn: twentyHoursAgo })).toEqual({
      action: 'AUTO_CLOSE',
      attendanceId: 'att-stale',
      autoCheckOutAt: new Date(twentyHoursAgo.getTime() + 2 * 60 * 60 * 1000),
    });
  });

  it('checks member in via QR code, blocks without active subscription, and checks out cleanly', async () => {
    const client = db.createDelegate();
    memoryCache.set(CACHE_KEYS.DASHBOARD_STATS, { activeMembers: 1 }, 60);

    await expect(performMemberCheckIn(client, ' ', now)).rejects.toThrow(BadRequestError);
    await expect(performMemberCheckIn(client, 'NONEXISTENT', now)).rejects.toThrow(NotFoundError);

    const checkInResult = await performMemberCheckIn(client, 'LAKZEE-QR-001', now);
    expect(checkInResult.memberName).toBe('Aarav One');
    expect(memoryCache.get(CACHE_KEYS.DASHBOARD_STATS)).toBeNull();

    // Duplicate check-in within 16h must fail
    await expect(
      performMemberCheckIn(client, '001', new Date(now.getTime() + 60 * 60 * 1000))
    ).rejects.toThrow(BadRequestError);

    const checkOutResult = await performMemberCheckOut(
      client,
      '001',
      new Date(now.getTime() + 45 * 60 * 1000)
    );
    expect(checkOutResult.memberName).toBe('Aarav One');
    expect(db.attendances[0].checkOut).not.toBeNull();

    // Removing active subscription blocks subsequent check-in
    db.subscriptions = [];
    await expect(
      performMemberCheckIn(client, '001', new Date(now.getTime() + 2 * 60 * 60 * 1000))
    ).rejects.toThrow(ForbiddenError);
  });
});
