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

    // 1. Revenue 30d
    const recentSubs = await prisma.subscription.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      include: { plan: true }
    });
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
    const monthSubs = await prisma.subscription.findMany({
      where: { createdAt: { gte: firstDayOfMonth } },
      include: { plan: true }
    });
    const revenueThisMonth = monthSubs.reduce((sum, sub) => {
      const price = sub.plan?.price || 0;
      if (sub.paymentStatus === 'PAID') return sum + price;
      if (sub.paymentStatus === 'PENDING') {
        if (sub.balanceAmount > 0) return sum + Math.max(0, price - sub.balanceAmount);
        return sum;
      }
      return sum;
    }, 0);

    // 3. Active Members
    const activeMembersCount = await prisma.memberProfile.count({
      where: {
        subscriptions: {
          some: {
            endDate: { gte: new Date() },
            status: 'ACTIVE'
          }
        }
      }
    });

    // 4. Visits 30d
    const visits30d = await prisma.attendance.count({
      where: { checkIn: { gte: thirtyDaysAgo } }
    });

    // 1. Daily Revenue (Last 7 Days)
    const dailyRevenueMap: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const name = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      dailyRevenueMap[name] = 0;
    }

    const last7DaysSubs = await prisma.subscription.findMany({
      where: { createdAt: { gte: sixDaysAgo } },
      include: { plan: true }
    });

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

    const last7DaysVisits = await prisma.attendance.findMany({
      where: { checkIn: { gte: sixDaysAgo } }
    });

    last7DaysVisits.forEach(att => {
      const name = att.checkIn.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (dailyVisitsMap[name] !== undefined) {
        dailyVisitsMap[name] += 1;
      }
    });

    const dailyVisits = Object.keys(dailyVisitsMap).map(name => ({ name, visits: dailyVisitsMap[name] }));

    // 3. Gender Mix
    const activeMembers = await prisma.memberProfile.findMany({
      where: {
        subscriptions: {
          some: {
            endDate: { gte: new Date() },
            status: 'ACTIVE'
          }
        }
      },
      select: { gender: true }
    });
    
    let male = 0, female = 0, other = 0;
    activeMembers.forEach(m => {
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
    const payments30dForMix = await prisma.subscription.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      include: { plan: true }
    });
    
    const paymentMap: Record<string, number> = {};
    payments30dForMix.forEach(sub => {
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

    res.json({
      status: 'success',
      data: {
        revenue30d,
        revenueThisMonth,
        activeMembers: activeMembersCount,
        visits30d,
        dailyRevenue,
        dailyVisits,
        genderMix,
        paymentMix
      }
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to fetch reports' });
  }
};
