import { Request, Response } from 'express';
import { prisma } from '../app';

export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const sevenDaysFromNow = new Date(today);
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    const fourteenDaysAgo = new Date(today);
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const [
      activeMembersCount,
      checkInsCount,
      newSignupsCount,
      recentSubscriptions,
      recentCheckIns,
      todaysSubs,
      expiringSubs,
      expiredSubs,
      allMembersWithDob,
      last14DaysSubs,
      recentSubsList,
      pendingSubs
    ] = await Promise.all([
      // 1. Active Members
      prisma.memberProfile.count({
        where: {
          subscriptions: {
            some: {
              endDate: { gte: today },
              status: 'ACTIVE'
            }
          }
        }
      }),
      // 2. Today's Check-ins
      prisma.attendance.count({
        where: { date: { gte: today } }
      }),
      // 3. New Signups (this month)
      prisma.user.count({
        where: {
          role: 'MEMBER',
          createdAt: { gte: firstDayOfMonth }
        }
      }),
      // 4. Monthly Revenue (Estimated based on Active Subscriptions created this month)
      prisma.subscription.findMany({
        where: { createdAt: { gte: firstDayOfMonth } },
        include: { plan: true }
      }),
      // 5. Recent Activity (Latest 5 check-ins)
      prisma.attendance.findMany({
        take: 5,
        orderBy: { checkIn: 'desc' },
        include: {
          member: { include: { user: true } }
        }
      }),
      // 6. Today's Collection
      prisma.subscription.findMany({
        where: { createdAt: { gte: today } },
        include: { plan: true }
      }),
      // 7. Expiring in 7 Days
      prisma.subscription.findMany({
        where: {
          status: 'ACTIVE',
          endDate: { gte: today, lte: sevenDaysFromNow }
        },
        include: {
          plan: true,
          member: { include: { user: true } }
        },
        orderBy: { endDate: 'asc' }
      }),
      // 8. Expired
      prisma.subscription.findMany({
        where: {
          OR: [
            { status: 'EXPIRED' },
            { endDate: { lt: today } }
          ],
          member: {
            subscriptions: {
              none: {
                endDate: { gte: today },
                status: 'ACTIVE'
              }
            }
          }
        },
        distinct: ['memberId'],
        include: {
          plan: true,
          member: { include: { user: true } }
        },
        orderBy: { endDate: 'desc' }
      }),
      // 9. Members with DOB
      prisma.memberProfile.findMany({
        where: { dob: { not: null } },
        include: { user: true }
      }),
      // 10. 14 Days Revenue
      prisma.subscription.findMany({
        where: { createdAt: { gte: fourteenDaysAgo } },
        include: { plan: true }
      }),
      // 11. Recent Payments List
      prisma.subscription.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          plan: true,
          member: { include: { user: true } }
        }
      }),
      // 12. Pending Subscriptions
      prisma.subscription.findMany({
        where: { paymentStatus: 'PENDING' },
        include: { 
          plan: true,
          member: { include: { user: true } }
        }
      })
    ]);

    const monthlyRevenue = recentSubscriptions.reduce((sum, sub) => {
      const price = sub.plan?.price || 0;
      if (sub.paymentStatus === 'PAID') return sum + price;
      if (sub.paymentStatus === 'PENDING') {
        if (sub.balanceAmount > 0) return sum + Math.max(0, price - sub.balanceAmount);
        return sum;
      }
      return sum;
    }, 0);

    const recentActivity = recentCheckIns.map(log => ({
      id: log.id,
      title: "Member checked in",
      description: `Lakzee ID: ${log.member.memberId} - ${log.member.user.firstName} ${log.member.user.lastName}`,
      time: log.checkIn.toISOString()
    }));

    const todaysCollection = todaysSubs.reduce((sum, sub) => {
      const price = sub.plan?.price || 0;
      if (sub.paymentStatus === 'PAID') return sum + price;
      if (sub.paymentStatus === 'PENDING') {
        if (sub.balanceAmount > 0) return sum + Math.max(0, price - sub.balanceAmount);
        return sum;
      }
      return sum;
    }, 0);

    const expiringIn7Days = expiringSubs.length;
    const expiringMembersList = expiringSubs.map(sub => ({
      id: sub.id,
      memberId: sub.member.memberId,
      name: `${sub.member.user.firstName} ${sub.member.user.lastName}`,
      phone: sub.member.user.phone,
      planName: sub.plan?.name || 'Unknown Plan',
      date: sub.endDate.toISOString()
    }));

    const expiredMembers = expiredSubs.length;
    const expiredMembersList = expiredSubs.map(sub => ({
      id: sub.id,
      memberId: sub.member.memberId,
      name: `${sub.member.user.firstName} ${sub.member.user.lastName}`,
      phone: sub.member.user.phone,
      planName: sub.plan?.name || 'Unknown Plan',
      date: sub.endDate.toISOString()
    }));

    // Birthdays This Month and Today
    const currentMonth = today.getMonth(); // 0-11
    const currentDate = today.getDate();
    
    // We use getUTCMonth/Date because dates saved from frontend (e.g. YYYY-MM-DD) are often stored as UTC midnight
    const birthdaysThisMonth = allMembersWithDob.filter(m => m.dob && m.dob.getUTCMonth() === currentMonth).length;
    
    const todaysBirthdays = allMembersWithDob
      .filter(m => m.dob && m.dob.getUTCMonth() === currentMonth && m.dob.getUTCDate() === currentDate)
      .map(m => ({
        id: m.id,
        name: `${m.user.firstName} ${m.user.lastName}`,
        memberId: m.memberId
      }));

    // 14 Days Revenue Chart Data
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
        const price = sub.plan?.price || 0;
        let amount = 0;
        if (sub.paymentStatus === 'PAID') amount = price;
        else if (sub.paymentStatus === 'PENDING' && sub.balanceAmount > 0) amount = Math.max(0, price - sub.balanceAmount);
        
        revenueMap[name] += amount;
      }
    });

    const revenueLast14Days = Object.keys(revenueMap).map(name => ({
      name,
      revenue: revenueMap[name]
    }));

    // Recent Payments List
    const recentPaymentsList = recentSubsList
      .map(sub => {
        const price = sub.plan?.price || 0;
        let amount = 0;
        if (sub.paymentStatus === 'PAID') amount = price;
        else if (sub.paymentStatus === 'PENDING' && sub.balanceAmount > 0) amount = Math.max(0, price - sub.balanceAmount);
        
        return {
          id: sub.id,
          amount,
          planName: sub.plan?.name || 'Unknown Plan',
          memberName: `${sub.member.user.firstName} ${sub.member.user.lastName}`,
          date: sub.createdAt.toISOString()
        };
      })
      .filter(p => p.amount > 0)
      .slice(0, 5);
    
    let totalPendingAmount = 0;
    const pendingMembersList = pendingSubs.map(sub => {
      const price = sub.plan?.price || 0;
      let owes = price;
      if (sub.balanceAmount > 0) {
        owes = sub.balanceAmount;
      }
      totalPendingAmount += owes;

      return {
        id: sub.id,
        memberId: sub.member.memberId,
        name: `${sub.member.user.firstName} ${sub.member.user.lastName}`,
        phone: sub.member.user.phone,
        planName: sub.plan?.name || 'Unknown Plan',
        balanceAmount: owes,
        date: sub.createdAt.toISOString()
      };
    });

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
        todaysBirthdays,
        revenueLast14Days,
        recentPaymentsList,
        totalPendingAmount,
        pendingMembersList,
        expiringMembersList,
        expiredMembersList
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch dashboard stats' });
  }
};
