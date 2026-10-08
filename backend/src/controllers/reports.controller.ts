import { Request, Response } from 'express';
import { prisma } from '../app';

export const getReports = async (req: Request, res: Response) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 29); // 30 days including today

    const sixDaysAgo = new Date(today);
    sixDaysAgo.setDate(today.getDate() - 6); // 7 days including today

    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [
      recentSubs,
      monthSubs,
      activeMembersProfiles,
      visits30d,
      last7DaysSubs,
      last7DaysVisits,
      allSubs
    ] = await Promise.all([
      // 1. Revenue 30d & Payment Mix
      prisma.subscription.findMany({
        where: { createdAt: { gte: thirtyDaysAgo } },
        include: { plan: true },
        orderBy: { createdAt: 'asc' }
      }),
      // 2. Revenue This Month & Payments List
      prisma.subscription.findMany({
        where: { createdAt: { gte: firstDayOfMonth } },
        include: { 
          plan: true,
          member: {
            include: {
              user: {
                select: { id: true, firstName: true, lastName: true, email: true, phone: true }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      // 3. Active Members with Details
      prisma.memberProfile.findMany({
        where: {
          subscriptions: {
            some: {
              endDate: { gte: new Date() },
              status: 'ACTIVE'
            }
          }
        },
        select: {
          id: true,
          memberId: true,
          gender: true,
          joiningDate: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              email: true
            }
          },
          subscriptions: {
            where: {
              endDate: { gte: new Date() },
              status: 'ACTIVE'
            },
            take: 1,
            orderBy: { endDate: 'desc' },
            select: {
              startDate: true,
              endDate: true,
              plan: {
                select: {
                  name: true,
                  price: true
                }
              }
            }
          }
        },
        orderBy: { memberId: 'asc' }
      }),
      // 4. Visits 30d
      prisma.attendance.count({
        where: { checkIn: { gte: thirtyDaysAgo } }
      }),
      // 5. Daily Revenue (Last 7 Days)
      prisma.subscription.findMany({
        where: { createdAt: { gte: sixDaysAgo } },
        include: { plan: true }
      }),
      // 6. Daily Visits (Last 7 Days)
      prisma.attendance.findMany({
        where: { checkIn: { gte: sixDaysAgo } }
      }),
      // 7. All subscriptions for entire daily revenue (earliest to latest)
      prisma.subscription.findMany({
        include: { plan: true },
        orderBy: { createdAt: 'asc' }
      })
    ]);

    // 1. Revenue 30d
    const revenue30d = recentSubs.reduce((sum, sub) => {
      const price = sub.plan?.price || 0;
      if (sub.paymentStatus === 'PAID') return sum + price;
      if (sub.paymentStatus === 'PENDING') {
        if (sub.balanceAmount > 0) return sum + Math.max(0, price - sub.balanceAmount);
        return sum;
      }
      return sum;
    }, 0);

    // 2. Revenue This Month
    const revenueThisMonth = monthSubs.reduce((sum, sub) => {
      const price = sub.plan?.price || 0;
      if (sub.paymentStatus === 'PAID') return sum + price;
      if (sub.paymentStatus === 'PENDING') {
        if (sub.balanceAmount > 0) return sum + Math.max(0, price - sub.balanceAmount);
        return sum;
      }
      return sum;
    }, 0);

    // 1. Daily Revenue (Last 7 Days)
    const dailyRevenueMap: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const name = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      dailyRevenueMap[name] = 0;
    }

    last7DaysSubs.forEach(sub => {
      const name = sub.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (dailyRevenueMap[name] !== undefined) {
        const price = sub.plan?.price || 0;
        if (sub.paymentStatus === 'PAID') {
          dailyRevenueMap[name] += price;
        } else if (sub.paymentStatus === 'PENDING' && sub.balanceAmount > 0) {
          dailyRevenueMap[name] += Math.max(0, price - sub.balanceAmount);
        }
      }
    });

    const dailyRevenue = Object.keys(dailyRevenueMap).map(name => ({ name, revenue: dailyRevenueMap[name] }));

    // 2. Daily Visits (Last 7 Days)
    const dailyVisitsMap: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const name = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      dailyVisitsMap[name] = 0;
    }

    last7DaysVisits.forEach(att => {
      const name = att.checkIn.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (dailyVisitsMap[name] !== undefined) {
        dailyVisitsMap[name] += 1;
      }
    });

    const dailyVisits = Object.keys(dailyVisitsMap).map(name => ({ name, visits: dailyVisitsMap[name] }));

    // 3. Gender Mix
    let male = 0, female = 0, other = 0;
    activeMembersProfiles.forEach(m => {
      if (m.gender?.toUpperCase() === 'MALE') male++;
      else if (m.gender?.toUpperCase() === 'FEMALE') female++;
      else other++;
    });
    
    const genderMix = [];
    if (male > 0) genderMix.push({ name: 'Male', value: male });
    if (female > 0) genderMix.push({ name: 'Female', value: female });
    if (other > 0) genderMix.push({ name: 'Other', value: other });
    
    if (genderMix.length === 0) {
      genderMix.push({ name: 'None', value: 1 });
    }

    // 4. Payment Mix
    const paymentMap: Record<string, number> = {};
    recentSubs.forEach(sub => {
      const price = sub.plan?.price || 0;
      let paid = 0;
      if (sub.paymentStatus === 'PAID') {
        paid = price;
      } else if (sub.paymentStatus === 'PENDING' && sub.balanceAmount > 0) {
        paid = Math.max(0, price - sub.balanceAmount);
      }
      
      if (paid > 0) {
        paymentMap[sub.paymentMethod] = (paymentMap[sub.paymentMethod] || 0) + paid;
      }
    });

    const paymentMix = Object.keys(paymentMap).map(method => ({ name: method, value: paymentMap[method] }));
    if (paymentMix.length === 0) {
      paymentMix.push({ name: 'No Data', value: 1 });
    }

    // 5. Daily Revenue (Last 30 Days Breakdown for 30D Graph Modal)
    const dailyRevenue30dMap: Record<string, { date: string, name: string, fullDate: string, revenue: number, count: number }> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      const name = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const fullDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      dailyRevenue30dMap[key] = { date: key, name, fullDate, revenue: 0, count: 0 };
    }

    recentSubs.forEach(sub => {
      const d = new Date(sub.createdAt);
      const key = d.toISOString().split('T')[0];
      if (dailyRevenue30dMap[key]) {
        const price = sub.plan?.price || 0;
        let paid = 0;
        if (sub.paymentStatus === 'PAID') {
          paid = price;
        } else if (sub.paymentStatus === 'PENDING' && sub.balanceAmount > 0) {
          paid = Math.max(0, price - sub.balanceAmount);
        }
        if (paid > 0) {
          dailyRevenue30dMap[key].revenue += paid;
          dailyRevenue30dMap[key].count += 1;
        }
      }
    });

    const dailyRevenue30d = Object.values(dailyRevenue30dMap);

    // 6. This Month's Members & Payments List
    const thisMonthPayments = monthSubs.map(sub => {
      const price = sub.plan?.price || 0;
      let paid = 0;
      if (sub.paymentStatus === 'PAID') {
        paid = price;
      } else if (sub.paymentStatus === 'PENDING' && sub.balanceAmount > 0) {
        paid = Math.max(0, price - sub.balanceAmount);
      }
      return {
        id: sub.id,
        memberId: sub.member?.memberId || '',
        memberName: `${sub.member?.user?.firstName || ''} ${sub.member?.user?.lastName || ''}`.trim() || 'Unknown Member',
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
        createdAt: sub.createdAt
      };
    });

    // 7. Active Members Details List
    const activeMembersList = activeMembersProfiles.map(m => {
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
        status: 'ACTIVE'
      };
    });

    // 8. Entire Daily Revenue from Earliest to Latest (all-time chronological)
    let entireDailyRevenue: Array<{ date: string, name: string, fullDate: string, revenue: number, count: number }> = [];
    if (allSubs.length > 0) {
      const earliestDate = new Date(allSubs[0].createdAt);
      earliestDate.setHours(0, 0, 0, 0);
      const start = earliestDate > today ? today : earliestDate;

      const entireDailyMap: Record<string, { date: string, name: string, fullDate: string, revenue: number, count: number }> = {};
      const curr = new Date(start);
      while (curr <= today) {
        const key = curr.toISOString().split('T')[0];
        const name = curr.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const fullDate = curr.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        entireDailyMap[key] = { date: key, name, fullDate, revenue: 0, count: 0 };
        curr.setDate(curr.getDate() + 1);
      }

      allSubs.forEach(sub => {
        const d = new Date(sub.createdAt);
        const key = d.toISOString().split('T')[0];
        const price = sub.plan?.price || 0;
        let paid = 0;
        if (sub.paymentStatus === 'PAID') {
          paid = price;
        } else if (sub.paymentStatus === 'PENDING' && sub.balanceAmount > 0) {
          paid = Math.max(0, price - sub.balanceAmount);
        }
        if (paid > 0 && entireDailyMap[key]) {
          entireDailyMap[key].revenue += paid;
          entireDailyMap[key].count += 1;
        }
      });

      entireDailyRevenue = Object.values(entireDailyMap);
    }

    res.json({
      status: 'success',
      data: {
        revenue30d,
        revenueThisMonth,
        activeMembers: activeMembersProfiles.length,
        visits30d,
        dailyRevenue,
        dailyVisits,
        genderMix,
        paymentMix,
        dailyRevenue30d,
        thisMonthPayments,
        activeMembersList,
        entireDailyRevenue
      }
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to fetch reports' });
  }
};
