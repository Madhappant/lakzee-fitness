import { Request, Response } from 'express';
import { prisma } from '../app';

export const getReports = async (req: Request, res: Response) => {
  try {
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const firstDayOfMonth = new Date();
    firstDayOfMonth.setDate(1);
    firstDayOfMonth.setHours(0, 0, 0, 0);

    // Basic Stats
    const recentSubs = await prisma.subscription.findMany({
      where: { createdAt: { gte: thirtyDaysAgo }, paymentStatus: 'PAID' },
      include: { plan: true }
    });
    const revenue30d = recentSubs.reduce((sum, sub) => sum + (sub.plan?.price || 0), 0);

    const monthSubs = await prisma.subscription.findMany({
      where: { createdAt: { gte: firstDayOfMonth }, paymentStatus: 'PAID' },
      include: { plan: true }
    });
    const revenueThisMonth = monthSubs.reduce((sum, sub) => sum + (sub.plan?.price || 0), 0);

    const activeMembersCount = await prisma.user.count({ where: { role: 'MEMBER' } });

    const visits30d = await prisma.attendance.count({
      where: { checkIn: { gte: thirtyDaysAgo } }
    });

    // Chart Data Generation

    // 1. Daily Revenue (Last 7 Days)
    const dailyRevenueMap: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const name = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      dailyRevenueMap[name] = 0;
    }

    const last7DaysSubs = await prisma.subscription.findMany({
      where: { createdAt: { gte: sevenDaysAgo }, paymentStatus: 'PAID' },
      include: { plan: true }
    });

    last7DaysSubs.forEach(sub => {
      const name = sub.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (dailyRevenueMap[name] !== undefined) {
        dailyRevenueMap[name] += sub.plan?.price || 0;
      }
    });

    const dailyRevenue = Object.keys(dailyRevenueMap).map(name => ({ name, revenue: dailyRevenueMap[name] }));

    // 2. Daily Visits (Last 7 Days)
    const dailyVisitsMap: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const name = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      dailyVisitsMap[name] = 0;
    }

    const last7DaysVisits = await prisma.attendance.findMany({
      where: { checkIn: { gte: sevenDaysAgo } }
    });

    last7DaysVisits.forEach(att => {
      const name = att.checkIn.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (dailyVisitsMap[name] !== undefined) {
        dailyVisitsMap[name] += 1;
      }
    });

    const dailyVisits = Object.keys(dailyVisitsMap).map(name => ({ name, visits: dailyVisitsMap[name] }));

    // 3. Gender Mix
    const members = await prisma.memberProfile.findMany({
      select: { gender: true }
    });
    
    let male = 0, female = 0, other = 0;
    members.forEach(m => {
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

    // 4. Payment Mix (since we don't track payments yet, we will mock it based on seed data or empty)
    const payments = await prisma.payment.findMany({
      where: { paymentDate: { gte: thirtyDaysAgo } }
    });
    
    const paymentMap: Record<string, number> = {};
    payments.forEach(p => {
      paymentMap[p.method] = (paymentMap[p.method] || 0) + 1;
    });

    const paymentMix = Object.keys(paymentMap).map(method => ({ name: method, value: paymentMap[method] }));
    if (paymentMix.length === 0) {
      // Fallback if no payments are recorded yet, we just show a pending state
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
