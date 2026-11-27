/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from 'express';
import { prisma } from '../app';
import { asyncHandler } from '../middlewares/error.middleware';
import { CACHE_KEYS, memoryCache } from '../utils/cache';
import { computeCollectedAmount, roundCurrency } from '../services/subscription-ledger.service';

const formatLocalDateKey = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const getReports = asyncHandler(async (_req: Request, res: Response) => {
  const cached = memoryCache.get<any>(CACHE_KEYS.REPORTS_OVERVIEW);
  if (cached) {
    return res.json(cached);
  }

  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 29);

  const sixDaysAgo = new Date(today);
  sixDaysAgo.setDate(today.getDate() - 6);

  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  // Consolidates 4 overlapping Subscription queries into 1 projected scan + 3 parallel queries
  const [allSubs, activeMembersProfiles, visits30d, last7DaysVisits] = await Promise.all([
    prisma.subscription.findMany({
      select: {
        id: true,
        status: true,
        paymentStatus: true,
        paymentMethod: true,
        balanceAmount: true,
        startDate: true,
        endDate: true,
        createdAt: true,
        plan: {
          select: { name: true, price: true },
        },
        member: {
          select: {
            memberId: true,
            user: {
              select: { id: true, firstName: true, lastName: true, email: true, phone: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.memberProfile.findMany({
      where: {
        subscriptions: {
          some: { endDate: { gte: now }, status: 'ACTIVE' },
        },
      },
      select: {
        id: true,
        memberId: true,
        gender: true,
        joiningDate: true,
        user: {
          select: { id: true, firstName: true, lastName: true, phone: true, email: true },
        },
        subscriptions: {
          where: { endDate: { gte: now }, status: 'ACTIVE' },
          take: 1,
          orderBy: { endDate: 'desc' },
          select: {
            startDate: true,
            endDate: true,
            plan: { select: { name: true, price: true } },
          },
        },
      },
      orderBy: { memberId: 'asc' },
    }),
    prisma.attendance.count({
      where: { checkIn: { gte: thirtyDaysAgo } },
    }),
    prisma.attendance.findMany({
      where: { checkIn: { gte: sixDaysAgo } },
      select: { checkIn: true },
    }),
  ]);

  const dailyRevenueMap: Record<string, number> = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dailyRevenueMap[d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })] = 0;
  }

  const dailyVisitsMap: Record<string, number> = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dailyVisitsMap[d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })] = 0;
  }

  for (const att of last7DaysVisits) {
    const name = att.checkIn.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (dailyVisitsMap[name] !== undefined) {
      dailyVisitsMap[name] += 1;
    }
  }

  const dailyRevenue30dMap: Record<
    string,
    { date: string; name: string; fullDate: string; revenue: number; count: number }
  > = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = formatLocalDateKey(d);
    dailyRevenue30dMap[key] = {
      date: key,
      name: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      fullDate: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      revenue: 0,
      count: 0,
    };
  }

  const entireDailyMap: Record<
    string,
    { date: string; name: string; fullDate: string; revenue: number; count: number }
  > = {};

  if (allSubs.length > 0) {
    const earliestDate = new Date(allSubs[0].createdAt);
    earliestDate.setHours(0, 0, 0, 0);
    const start = earliestDate > today ? today : earliestDate;
    const curr = new Date(start);
    while (curr <= today) {
      const key = formatLocalDateKey(curr);
      entireDailyMap[key] = {
        date: key,
        name: curr.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        fullDate: curr.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        revenue: 0,
        count: 0,
      };
      curr.setDate(curr.getDate() + 1);
    }
  }

  let revenue30d = 0;
  let revenueThisMonth = 0;
  const paymentMap: Record<string, number> = {};
  const thisMonthPaymentsDesc: any[] = [];

  // Single O(N) pass over allSubs ascending -> build descending month list cleanly via unshift or reverse
  for (let i = 0; i < allSubs.length; i++) {
    const sub = allSubs[i];
    const paid = computeCollectedAmount(sub);
    const key = formatLocalDateKey(sub.createdAt);

    if (paid > 0 && entireDailyMap[key]) {
      entireDailyMap[key].revenue = roundCurrency(entireDailyMap[key].revenue + paid);
      entireDailyMap[key].count += 1;
    }

    if (sub.createdAt >= thirtyDaysAgo) {
      revenue30d += paid;
      if (paid > 0) {
        paymentMap[sub.paymentMethod] = (paymentMap[sub.paymentMethod] || 0) + paid;
        if (dailyRevenue30dMap[key]) {
          dailyRevenue30dMap[key].revenue = roundCurrency(dailyRevenue30dMap[key].revenue + paid);
          dailyRevenue30dMap[key].count += 1;
        }
      }
    }

    if (sub.createdAt >= sixDaysAgo) {
      const name = sub.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (dailyRevenueMap[name] !== undefined) {
        dailyRevenueMap[name] += paid;
      }
    }

    if (sub.createdAt >= firstDayOfMonth) {
      revenueThisMonth += paid;
      const price = sub.plan?.price || 0;
      thisMonthPaymentsDesc.push({
        id: sub.id,
        memberId: sub.member?.memberId || '',
        memberName:
          `${sub.member?.user?.firstName || ''} ${sub.member?.user?.lastName || ''}`.trim() ||
          'Unknown Member',
        email: sub.member?.user?.email || '',
        phone: sub.member?.user?.phone || '',
        planName: sub.plan?.name || 'Membership Plan',
        planPrice: price,
        amountPaid: paid,
        balanceAmount: sub.balanceAmount || 0,
        paymentStatus: sub.paymentStatus,
        paymentMethod: sub.paymentMethod || 'CASH',
        status: sub.status,
        startDate: sub.startDate,
        endDate: sub.endDate,
        createdAt: sub.createdAt,
      });
    }
  }

  thisMonthPaymentsDesc.reverse();

  let male = 0;
  let female = 0;
  let other = 0;
  const activeMembersList = activeMembersProfiles.map((m) => {
    const g = m.gender?.toUpperCase();
    if (g === 'MALE') male++;
    else if (g === 'FEMALE') female++;
    else other++;

    const currentSub = m.subscriptions[0];
    return {
      id: m.id,
      userId: m.user?.id,
      memberId: m.memberId,
      name: `${m.user?.firstName || ''} ${m.user?.lastName || ''}`.trim() || 'Unknown Member',
      email: m.user?.email || '',
      phone: m.user?.phone || '',
      planName: currentSub?.plan?.name || 'Active Plan',
      planPrice: currentSub?.plan?.price || 0,
      startDate: currentSub?.startDate,
      endDate: currentSub?.endDate,
      status: 'ACTIVE',
    };
  });

  const genderMix = [];
  if (male > 0) genderMix.push({ name: 'Male', value: male });
  if (female > 0) genderMix.push({ name: 'Female', value: female });
  if (other > 0) genderMix.push({ name: 'Other', value: other });
  if (genderMix.length === 0) genderMix.push({ name: 'None', value: 1 });

  const paymentMix = Object.keys(paymentMap).map((method) => ({
    name: method,
    value: roundCurrency(paymentMap[method]),
  }));
  if (paymentMix.length === 0) paymentMix.push({ name: 'No Data', value: 1 });

  const dailyRevenue = Object.keys(dailyRevenueMap).map((name) => ({
    name,
    revenue: roundCurrency(dailyRevenueMap[name]),
  }));

  const dailyVisits = Object.keys(dailyVisitsMap).map((name) => ({
    name,
    visits: dailyVisitsMap[name],
  }));

  const payload = {
    status: 'success',
    data: {
      revenue30d: roundCurrency(revenue30d),
      revenueThisMonth: roundCurrency(revenueThisMonth),
      activeMembers: activeMembersProfiles.length,
      visits30d,
      dailyRevenue,
      dailyVisits,
      genderMix,
      paymentMix,
      dailyRevenue30d: Object.values(dailyRevenue30dMap),
      thisMonthPayments: thisMonthPaymentsDesc,
      activeMembersList,
      entireDailyRevenue: Object.values(entireDailyMap),
    },
  };

  memoryCache.set(CACHE_KEYS.REPORTS_OVERVIEW, payload, 30);
  res.json(payload);
});
