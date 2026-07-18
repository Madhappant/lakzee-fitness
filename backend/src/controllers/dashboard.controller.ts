import { Request, Response } from 'express';
import { prisma } from '../app';

export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    // 1. Active Members
    const activeMembersCount = await prisma.user.count({
      where: { role: 'MEMBER' }
    });

    // 2. Today's Check-ins
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkInsCount = await prisma.attendance.count({
      where: {
        date: {
          gte: today,
        }
      }
    });

    // 3. New Signups (this month)
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const newSignupsCount = await prisma.user.count({
      where: {
        role: 'MEMBER',
        createdAt: {
          gte: firstDayOfMonth
        }
      }
    });

    // 4. Monthly Revenue (Estimated based on Active Subscriptions created this month)
    const recentSubscriptions = await prisma.subscription.findMany({
      where: {
        createdAt: {
          gte: firstDayOfMonth
        },
        paymentStatus: 'PAID'
      },
      include: {
        plan: true
      }
    });

    const monthlyRevenue = recentSubscriptions.reduce((acc, sub) => acc + (sub.plan?.price || 0), 0);

    // 5. Recent Activity (Latest 5 check-ins)
    const recentCheckIns = await prisma.attendance.findMany({
      take: 5,
      orderBy: { checkIn: 'desc' },
      include: {
        member: {
          include: { user: true }
        }
      }
    });

    const recentActivity = recentCheckIns.map(log => ({
      id: log.id,
      title: "Member checked in",
      description: `Lakzee ID: ${log.member.memberId} - ${log.member.user.firstName} ${log.member.user.lastName}`,
      time: log.checkIn.toISOString()
    }));

    // NEW METRICS ADDED FROM LOVABLE UI:
    // Today's Collection (Revenue from subscriptions created today)
    const todaysSubs = await prisma.subscription.findMany({
      where: { createdAt: { gte: today }, paymentStatus: 'PAID' },
      include: { plan: true }
    });
    const todaysCollection = todaysSubs.reduce((acc, sub) => acc + (sub.plan?.price || 0), 0);

    // Expiring in 7 Days
    const sevenDaysFromNow = new Date(today);
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    const expiringIn7Days = await prisma.subscription.count({
      where: {
        status: 'ACTIVE',
        endDate: { gte: today, lte: sevenDaysFromNow }
      }
    });

    // Expired
    const expiredMembers = await prisma.subscription.count({
      where: {
        OR: [
          { status: 'EXPIRED' },
          { endDate: { lt: today } }
        ]
      }
    });

    // Birthdays This Month (SQLite doesn't have easy month extraction, so we fetch and filter in memory)
    const currentMonth = today.getMonth(); // 0-11
    const allMembersWithDob = await prisma.memberProfile.findMany({
      where: { dob: { not: null } },
      select: { dob: true }
    });
    const birthdaysThisMonth = allMembersWithDob.filter(m => m.dob && m.dob.getMonth() === currentMonth).length;

    // 14 Days Revenue Chart Data
    const fourteenDaysAgo = new Date(today);
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    
    const last14DaysSubs = await prisma.subscription.findMany({
      where: { createdAt: { gte: fourteenDaysAgo }, paymentStatus: 'PAID' },
      include: { plan: true }
    });

    const revenueMap: Record<string, number> = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const name = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      revenueMap[name] = 0;
    }

    last14DaysSubs.forEach(sub => {
      const name = sub.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (revenueMap[name] !== undefined) {
        revenueMap[name] += sub.plan?.price || 0;
      }
    });

    const revenueLast14Days = Object.keys(revenueMap).map(name => ({
      name,
      revenue: revenueMap[name]
    }));

    // Recent Payments List (using subscriptions as proxy for payments for now)
    const recentSubsList = await prisma.subscription.findMany({
      take: 5,
      where: { paymentStatus: 'PAID' },
      orderBy: { createdAt: 'desc' },
      include: {
        plan: true,
        member: {
          include: { user: true }
        }
      }
    });

    const recentPaymentsList = recentSubsList.map(sub => ({
      id: sub.id,
      amount: sub.plan?.price || 0,
      planName: sub.plan?.name || 'Unknown Plan',
      memberName: `${sub.member.user.firstName} ${sub.member.user.lastName}`,
      date: sub.createdAt.toISOString()
    }));

    res.json({
      status: 'success',
      data: {
        activeMembers: activeMembersCount,
        todaysCheckIns: checkInsCount,
        newSignups: newSignupsCount,
        monthlyRevenue: monthlyRevenue,
        recentActivity: recentActivity,
        todaysCollection,
        expiringIn7Days,
        expiredMembers,
        birthdaysThisMonth,
        revenueLast14Days,
        recentPaymentsList
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch dashboard stats' });
  }
};
