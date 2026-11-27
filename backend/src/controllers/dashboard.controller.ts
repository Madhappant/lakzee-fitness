/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from 'express';
import { prisma } from '../app';
import { asyncHandler } from '../middlewares/error.middleware';
import { CACHE_KEYS, memoryCache } from '../utils/cache';
import {
  computeCollectedAmount,
  computePendingBalance,
  roundCurrency,
} from '../services/subscription-ledger.service';

export const getDashboardStats = asyncHandler(async (_req: Request, res: Response) => {
  const cached = memoryCache.get<any>(CACHE_KEYS.DASHBOARD_STATS);
  if (cached) {
    return res.json(cached);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const sevenDaysFromNow = new Date(today);
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
  const fourteenDaysAgo = new Date(today);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  const revenueWindowStart = firstDayOfMonth < fourteenDaysAgo ? firstDayOfMonth : fourteenDaysAgo;

  // Consolidated projected queries: zero password/OTP/note over-fetching
  const [
    activeMembersData,
    checkInsCount,
    newMembersData,
    windowSubscriptions,
    recentCheckIns,
    expiringSubs,
    expiredSubs,
    allMembersWithDob,
    recentSubsList,
    pendingSubs,
  ] = await Promise.all([
    prisma.memberProfile.findMany({
      where: {
        subscriptions: {
          some: {
            endDate: { gte: today },
            status: 'ACTIVE',
          },
        },
      },
      select: {
        id: true,
        memberId: true,
        user: {
          select: { id: true, firstName: true, lastName: true, phone: true, email: true },
        },
        subscriptions: {
          where: { endDate: { gte: today }, status: 'ACTIVE' },
          take: 1,
          orderBy: { endDate: 'desc' },
          select: {
            startDate: true,
            endDate: true,
            plan: { select: { name: true } },
          },
        },
      },
      orderBy: { memberId: 'asc' },
    }),
    prisma.attendance.count({
      where: { date: { gte: today } },
    }),
    prisma.memberProfile.findMany({
      where: {
        user: {
          role: 'MEMBER',
          createdAt: { gte: firstDayOfMonth },
        },
      },
      select: {
        id: true,
        memberId: true,
        joiningDate: true,
        user: {
          select: { id: true, firstName: true, lastName: true, phone: true, email: true, createdAt: true },
        },
        subscriptions: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: { plan: { select: { name: true } } },
        },
      },
      orderBy: { joiningDate: 'desc' },
    }),
    // Single subscription window covers monthly revenue, today's collection, and 14-day chart
    prisma.subscription.findMany({
      where: { createdAt: { gte: revenueWindowStart } },
      select: {
        createdAt: true,
        paymentStatus: true,
        balanceAmount: true,
        plan: { select: { price: true } },
      },
    }),
    prisma.attendance.findMany({
      take: 5,
      orderBy: { checkIn: 'desc' },
      select: {
        id: true,
        checkIn: true,
        member: {
          select: {
            memberId: true,
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
    }),
    prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        endDate: { gte: today, lte: sevenDaysFromNow },
      },
      select: {
        id: true,
        endDate: true,
        plan: { select: { name: true } },
        member: {
          select: {
            memberId: true,
            user: { select: { firstName: true, lastName: true, phone: true } },
          },
        },
      },
      orderBy: { endDate: 'asc' },
    }),
    prisma.subscription.findMany({
      where: {
        OR: [{ status: 'EXPIRED' }, { endDate: { lt: today } }],
        member: {
          subscriptions: {
            none: { endDate: { gte: today }, status: 'ACTIVE' },
          },
        },
      },
      distinct: ['memberId'],
      select: {
        id: true,
        endDate: true,
        plan: { select: { name: true } },
        member: {
          select: {
            memberId: true,
            user: { select: { firstName: true, lastName: true, phone: true } },
          },
        },
      },
      orderBy: { endDate: 'desc' },
    }),
    prisma.memberProfile.findMany({
      where: { dob: { not: null } },
      select: {
        id: true,
        memberId: true,
        dob: true,
        user: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.subscription.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
        paymentStatus: true,
        balanceAmount: true,
        plan: { select: { name: true, price: true } },
        member: {
          select: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
    }),
    prisma.subscription.findMany({
      where: { paymentStatus: 'PENDING' },
      select: {
        id: true,
        createdAt: true,
        paymentStatus: true,
        balanceAmount: true,
        plan: { select: { name: true, price: true } },
        member: {
          select: {
            memberId: true,
            user: { select: { firstName: true, lastName: true, phone: true } },
          },
        },
      },
    }),
  ]);

  const revenueMap: Record<string, number> = {};
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const name = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    revenueMap[name] = 0;
  }

  let monthlyRevenue = 0;
  let todaysCollection = 0;
  for (const sub of windowSubscriptions) {
    const collected = computeCollectedAmount(sub);
    if (sub.createdAt >= firstDayOfMonth) monthlyRevenue += collected;
    if (sub.createdAt >= today) todaysCollection += collected;
    if (sub.createdAt >= fourteenDaysAgo) {
      const bucketName = sub.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (revenueMap[bucketName] !== undefined) {
        revenueMap[bucketName] += collected;
      }
    }
  }

  const revenueLast14Days = Object.keys(revenueMap).map((name) => ({
    name,
    revenue: roundCurrency(revenueMap[name]),
  }));

  const recentActivity = recentCheckIns.map((log) => ({
    id: log.id,
    title: 'Member checked in',
    description: `Lakzee ID: ${log.member.memberId} - ${log.member.user.firstName} ${log.member.user.lastName}`,
    time: log.checkIn.toISOString(),
  }));

  const expiringMembersList = expiringSubs.map((sub) => ({
    id: sub.id,
    memberId: sub.member.memberId,
    name: `${sub.member.user.firstName} ${sub.member.user.lastName}`,
    phone: sub.member.user.phone,
    planName: sub.plan?.name || 'Unknown Plan',
    date: sub.endDate.toISOString(),
  }));

  const expiredMembersList = expiredSubs.map((sub) => ({
    id: sub.id,
    memberId: sub.member.memberId,
    name: `${sub.member.user.firstName} ${sub.member.user.lastName}`,
    phone: sub.member.user.phone,
    planName: sub.plan?.name || 'Unknown Plan',
    date: sub.endDate.toISOString(),
  }));

  const currentMonth = today.getMonth();
  const currentDate = today.getDate();
  let birthdaysThisMonth = 0;
  const todaysBirthdays: { id: string; name: string; memberId: string }[] = [];

  for (const m of allMembersWithDob) {
    if (!m.dob) continue;
    if (m.dob.getUTCMonth() === currentMonth) {
      birthdaysThisMonth++;
      if (m.dob.getUTCDate() === currentDate) {
        todaysBirthdays.push({
          id: m.id,
          name: `${m.user.firstName} ${m.user.lastName}`,
          memberId: m.memberId,
        });
      }
    }
  }

  const recentPaymentsList = recentSubsList
    .map((sub) => ({
      id: sub.id,
      amount: computeCollectedAmount(sub),
      planName: sub.plan?.name || 'Unknown Plan',
      memberName: `${sub.member.user.firstName} ${sub.member.user.lastName}`,
      date: sub.createdAt.toISOString(),
    }))
    .filter((p) => p.amount > 0)
    .slice(0, 5);

  let totalPendingAmount = 0;
  const pendingMembersList = pendingSubs.map((sub) => {
    const owes = computePendingBalance(sub);
    totalPendingAmount += owes;
    return {
      id: sub.id,
      memberId: sub.member.memberId,
      name: `${sub.member.user.firstName} ${sub.member.user.lastName}`,
      phone: sub.member.user.phone,
      planName: sub.plan?.name || 'Unknown Plan',
      balanceAmount: owes,
      date: sub.createdAt.toISOString(),
    };
  });

  const activeMembersList = activeMembersData.map((m) => ({
    id: m.id,
    userId: m.user.id,
    memberId: m.memberId,
    name: `${m.user.firstName} ${m.user.lastName}`.trim(),
    phone: m.user.phone,
    email: m.user.email,
    planName: m.subscriptions[0]?.plan?.name || 'Active Plan',
    date: m.subscriptions[0]?.endDate ? m.subscriptions[0].endDate.toISOString() : undefined,
  }));

  const newMembersList = newMembersData.map((m) => ({
    id: m.id,
    userId: m.user.id,
    memberId: m.memberId,
    name: `${m.user.firstName} ${m.user.lastName}`.trim(),
    phone: m.user.phone,
    email: m.user.email,
    planName: m.subscriptions[0]?.plan?.name || 'No Plan Assigned',
    date: (m.joiningDate || m.user.createdAt).toISOString(),
  }));

  const responsePayload = {
    status: 'success',
    data: {
      activeMembers: activeMembersData.length,
      activeMembersList,
      todaysCheckIns: checkInsCount,
      newSignups: newMembersData.length,
      newMembersList,
      monthlyRevenue: roundCurrency(monthlyRevenue),
      recentActivity,
      todaysCollection: roundCurrency(todaysCollection),
      expiringIn7Days: expiringSubs.length,
      expiredMembers: expiredSubs.length,
      birthdaysThisMonth,
      todaysBirthdays,
      revenueLast14Days,
      recentPaymentsList,
      totalPendingAmount: roundCurrency(totalPendingAmount),
      pendingMembersList,
      expiringMembersList,
      expiredMembersList,
    },
  };

  memoryCache.set(CACHE_KEYS.DASHBOARD_STATS, responsePayload, 30);
  res.json(responsePayload);
});
