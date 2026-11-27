/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import {
  evaluateCheckInWindow,
  performMemberCheckIn,
  performMemberCheckOut,
} from '../src/services/attendance.service';
import { BadRequestError, ForbiddenError, NotFoundError } from '../src/utils/errors';
import { CACHE_KEYS, memoryCache } from '../src/utils/cache';

interface MockMember {
  id: string;
  memberId: string;
  qrCode: string;
  user: { firstName: string; lastName: string };
}

interface MockAttendance {
  id: string;
  memberId: string;
  date: Date;
  checkIn: Date;
  checkOut: Date | null;
}

function createAttendanceDbDouble(seed: {
  members: MockMember[];
  activeSubscriptions?: Array<{ id: string; memberId: string; status: string; endDate: Date }>;
  attendances?: MockAttendance[];
}) {
  const attendances: MockAttendance[] = [...(seed.attendances ?? [])];
  const activeSubs = seed.activeSubscriptions ?? [];
  let seq = attendances.length + 1;

  const db = {
    memberProfile: {
      findMany: async ({ where }: any) => {
        const ors: any[] = where?.OR ?? [];
        return seed.members.filter((m) =>
          ors.some((cond) => {
            if (cond.memberId?.equals) {
              return m.memberId.toLowerCase() === cond.memberId.equals.toLowerCase();
            }
            if (cond.qrCode?.equals) {
              return m.qrCode.toLowerCase() === cond.qrCode.equals.toLowerCase();
            }
            if (cond.user?.firstName?.contains) {
              return m.user.firstName.toLowerCase().includes(cond.user.firstName.contains.toLowerCase());
            }
            if (cond.user?.lastName?.contains) {
              return m.user.lastName.toLowerCase().includes(cond.user.lastName.contains.toLowerCase());
            }
            return false;
          })
        );
      },
    },
    subscription: {
      findFirst: async ({ where }: any) => {
        const match = activeSubs.find(
          (s) =>
            s.memberId === where.memberId &&
            s.status === where.status &&
            s.endDate >= where.endDate.gte
        );
        return match ? { id: match.id } : null;
      },
    },
    attendance: {
      findFirst: async ({ where }: any) => {
        const open = attendances
          .filter((a) => a.memberId === where.memberId && a.checkOut === null)
          .sort((a, b) => b.checkIn.getTime() - a.checkIn.getTime());
        return open[0] ?? null;
      },
      update: async ({ where, data }: any) => {
        const target = attendances.find((a) => a.id === where.id);
        if (!target) throw new Error('Attendance record not found');
        Object.assign(target, data);
        return target;
      },
      create: async ({ data }: any) => {
        const created: MockAttendance = {
          id: `att-${seq++}`,
          memberId: data.memberId,
          date: data.date,
          checkIn: data.date,
          checkOut: null,
        };
        attendances.push(created);
        return created;
      },
    },
    $transaction: async (cb: (tx: any) => Promise<any>) => cb(db),
  };

  return { db: db as unknown as PrismaClient, attendances };
}

describe('evaluateCheckInWindow pure decision rules', () => {
  const now = new Date('2026-11-27T18:00:00.000Z');

  it('allows check-in when there is no open attendance session', () => {
    assert.deepEqual(evaluateCheckInWindow(now, null), { action: 'ALLOW' });
  });

  it('rejects duplicate check-in within the 16-hour active session window', () => {
    const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000);
    assert.deepEqual(
      evaluateCheckInWindow(now, { id: 'att-1', checkIn: fourHoursAgo }),
      { action: 'REJECT_ALREADY_CHECKED_IN' }
    );
  });

  it('auto-closes stale open sessions >= 16h old at checkIn + 2h', () => {
    const twentyHoursAgo = new Date(now.getTime() - 20 * 60 * 60 * 1000);
    const decision = evaluateCheckInWindow(now, { id: 'att-stale', checkIn: twentyHoursAgo });
    assert.equal(decision.action, 'AUTO_CLOSE');
    if (decision.action === 'AUTO_CLOSE') {
      assert.equal(decision.attendanceId, 'att-stale');
      assert.equal(decision.autoCheckOutAt.getTime(), twentyHoursAgo.getTime() + 2 * 60 * 60 * 1000);
    }
  });
});

describe('performMemberCheckIn & performMemberCheckOut service orchestration', () => {
  const now = new Date('2026-11-27T10:00:00.000Z');
  const futureEnd = new Date('2026-12-27T00:00:00.000Z');
  const members: MockMember[] = [
    { id: 'prof-1', memberId: 'LKZ-101', qrCode: 'QR-101', user: { firstName: 'Arjun', lastName: 'Kumar' } },
    { id: 'prof-2', memberId: 'LKZ-102', qrCode: 'QR-102', user: { firstName: 'Arjun', lastName: 'Nair' } },
  ];

  beforeEach(() => {
    memoryCache.clear();
  });

  it('validates identifier input, missing members, and ambiguous name lookups', async () => {
    const { db } = createAttendanceDbDouble({ members });

    await assert.rejects(() => performMemberCheckIn(db, '   ', now), BadRequestError);
    await assert.rejects(() => performMemberCheckIn(db, 'UNKNOWN-99', now), NotFoundError);
    await assert.rejects(() => performMemberCheckIn(db, 'Arjun', now), BadRequestError);
  });

  it('blocks check-in when member has no active non-expired subscription', async () => {
    const { db } = createAttendanceDbDouble({ members, activeSubscriptions: [] });
    await assert.rejects(() => performMemberCheckIn(db, 'LKZ-101', now), ForbiddenError);
  });

  it('records check-in, invalidates cached analytics, and blocks double check-in within 16h', async () => {
    memoryCache.set(CACHE_KEYS.DASHBOARD_STATS, { cached: true }, 60);
    memoryCache.set(CACHE_KEYS.REPORTS_OVERVIEW, { cached: true }, 60);

    const { db, attendances } = createAttendanceDbDouble({
      members,
      activeSubscriptions: [{ id: 'sub-1', memberId: 'prof-1', status: 'ACTIVE', endDate: futureEnd }],
    });

    const result = await performMemberCheckIn(db, 'lkz-101', now);
    assert.equal(result.memberName, 'Arjun Kumar');
    assert.equal(attendances.length, 1);
    assert.equal(memoryCache.get(CACHE_KEYS.DASHBOARD_STATS), null);
    assert.equal(memoryCache.get(CACHE_KEYS.REPORTS_OVERVIEW), null);

    const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    await assert.rejects(() => performMemberCheckIn(db, 'QR-101', twoHoursLater), BadRequestError);
  });

  it('auto-closes abandoned check-ins >= 16h old and creates a fresh check-in', async () => {
    const staleStart = new Date(now.getTime() - 18 * 60 * 60 * 1000);
    const { db, attendances } = createAttendanceDbDouble({
      members,
      activeSubscriptions: [{ id: 'sub-1', memberId: 'prof-1', status: 'ACTIVE', endDate: futureEnd }],
      attendances: [{ id: 'att-old', memberId: 'prof-1', date: staleStart, checkIn: staleStart, checkOut: null }],
    });

    const result = await performMemberCheckIn(db, 'LKZ-101', now);
    assert.equal(attendances.length, 2);
    assert.equal(
      attendances[0].checkOut?.getTime(),
      staleStart.getTime() + 2 * 60 * 60 * 1000
    );
    assert.equal(result.attendance.id, 'att-2');
    assert.equal(result.attendance.checkOut, null);
  });

  it('checks out active members and rejects checkout when already checked out', async () => {
    const { db, attendances } = createAttendanceDbDouble({
      members,
      attendances: [{ id: 'att-1', memberId: 'prof-1', date: now, checkIn: now, checkOut: null }],
    });

    const checkoutTime = new Date(now.getTime() + 45 * 60 * 1000);
    const out = await performMemberCheckOut(db, 'LKZ-101', checkoutTime);
    assert.equal(out.memberName, 'Arjun Kumar');
    assert.equal(attendances[0].checkOut?.getTime(), checkoutTime.getTime());

    await assert.rejects(() => performMemberCheckOut(db, 'LKZ-101', checkoutTime), BadRequestError);
  });
});
