/* eslint-disable @typescript-eslint/no-explicit-any */
import { AnalyticsRepository, analyticsRepository } from '../repositories/analytics.repository';
import { roleHasPermission } from '../middlewares/auth.middleware';
import { CACHE_KEYS, memoryCache } from '../utils/cache';
import { scopedCacheKey } from '../utils/tenant';
import { computeCollectedAmount, computePendingBalance, roundCurrency } from './subscription-ledger.service';

const formatLocalDateKey = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export class AnalyticsService {
  constructor(private readonly repo: AnalyticsRepository = analyticsRepository) {}

  async getDashboardStats(branchId?: string | null) {
    const cacheKey = scopedCacheKey(CACHE_KEYS.DASHBOARD_STATS, branchId);
    const cached = await memoryCache.getDistributed<any>(cacheKey, 30);
    if (cached) {
      return { data: cached, cached: true };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const sevenDaysFromNow = new Date(today);
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    const fourteenDaysAgo = new Date(today);
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    const revenueWindowStart = firstDayOfMonth < fourteenDaysAgo ? firstDayOfMonth : fourteenDaysAgo;

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
    ] = await this.repo.fetchDashboardInputs({
      branchId,
      today,
      firstDayOfMonth,
      sevenDaysFromNow,
      revenueWindowStart,
    });

    const revenueMap: Record<string, number> = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      revenueMap[d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })] = 0;
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

    const dashboardData = {
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
      branchId: branchId ?? 'all',
      operationalAnalytics: await this.getOperationalAnalytics(branchId).catch(() => null),
    };

    memoryCache.set(cacheKey, dashboardData, 30);
    return { data: dashboardData, cached: false };
  }

  async getReportsOverview(branchId?: string | null) {
    const cacheKey = scopedCacheKey(CACHE_KEYS.REPORTS_OVERVIEW, branchId);
    const cached = await memoryCache.getDistributed<any>(cacheKey, 30);
    if (cached) {
      return { data: cached, cached: true };
    }

    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 29);

    const sixDaysAgo = new Date(today);
    sixDaysAgo.setDate(today.getDate() - 6);

    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [allSubs, activeMembersProfiles, visits30d, last7DaysVisits] =
      await this.repo.fetchReportsInputs({ branchId, now, thirtyDaysAgo, sixDaysAgo });

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

    const reportsData = {
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
    };

    memoryCache.set(cacheKey, reportsData, 30);
    return { data: reportsData, cached: false };
  }

  async getNotificationsFeed(
    userId: string,
    userRole: string,
    tzOffsetRaw?: unknown,
    branchId?: string | null
  ) {
    const notifications: any[] = [];
    let now = new Date();

    if (tzOffsetRaw) {
      const offset = parseInt(String(tzOffsetRaw), 10);
      if (!isNaN(offset)) {
        now = new Date(Date.now() - offset * 60000);
      }
    }

    const threeDaysFromNow = new Date(now);
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    if (roleHasPermission(userRole, ['ADMIN', 'RECEPTIONIST'])) {
      const [
        pendingInvoices,
        pendingSubs,
        expiringSubscriptions,
        membersWithBirthdays,
        recentAnnouncements,
      ] = await this.repo.fetchStaffNotificationsData({
        branchId,
        todayStart,
        threeDaysFromNow,
        includeBirthdays: roleHasPermission(userRole, ['ADMIN']),
      });

      const seenMemberPaymentIds = new Set<string>();

      for (const invoice of pendingInvoices) {
        seenMemberPaymentIds.add(invoice.memberId);
        const memberName = invoice.member?.user
          ? `${invoice.member.user.firstName} ${invoice.member.user.lastName}`.trim()
          : 'Member';
        notifications.push({
          id: `inv-${invoice.id}`,
          type: 'PAYMENT',
          title: 'Pending Payment',
          message: `${memberName} has a pending invoice of ₹${invoice.totalAmount}.`,
          date: invoice.createdAt,
          link: '/admin/payments',
          read: false,
        });
      }

      for (const sub of pendingSubs) {
        if (!seenMemberPaymentIds.has(sub.memberId)) {
          seenMemberPaymentIds.add(sub.memberId);
          const amount = sub.balanceAmount > 0 ? sub.balanceAmount : sub.plan?.price || 0;
          const memberName = sub.member?.user
            ? `${sub.member.user.firstName} ${sub.member.user.lastName}`.trim()
            : 'Member';
          notifications.push({
            id: `sub-pay-${sub.id}`,
            type: 'PAYMENT',
            title: 'Pending Subscription Payment',
            message: `${memberName} has a pending payment of ₹${amount} for ${sub.plan?.name || 'plan'}.`,
            date: sub.createdAt,
            link: '/admin/payments',
            read: false,
          });
        }
      }

      for (const sub of expiringSubscriptions) {
        const isExpired = sub.endDate < now;
        const memberName = sub.member?.user
          ? `${sub.member.user.firstName} ${sub.member.user.lastName}`.trim()
          : 'Member';
        const planName = sub.plan?.name || 'Membership';
        const memberUserId = sub.member?.userId;
        notifications.push({
          id: `sub-${sub.id}`,
          type: 'EXPIRY',
          title: isExpired ? 'Membership Expired' : 'Membership Expiring Soon',
          message: `${memberName}'s ${planName} plan ${isExpired ? 'expired on' : 'will expire on'} ${sub.endDate.toLocaleDateString()}.`,
          date: sub.endDate,
          link: memberUserId ? `/admin/members/${memberUserId}/plan` : '/admin/members',
          read: false,
        });
      }

      if (roleHasPermission(userRole, ['ADMIN'])) {
        const currentMonth = now.getUTCMonth();
        const currentDay = now.getUTCDate();

        for (const member of membersWithBirthdays) {
          if (!member.dob) continue;
          if (member.dob.getUTCMonth() === currentMonth && member.dob.getUTCDate() === currentDay) {
            const memberName = member.user
              ? `${member.user.firstName} ${member.user.lastName}`.trim()
              : 'Member';
            notifications.push({
              id: `bday-${member.id}`,
              type: 'SYSTEM',
              title: 'Member Birthday Today',
              message: `It's ${memberName}'s birthday today.`,
              date: now,
              link: `/admin/members?viewMember=${member.userId}`,
              read: false,
            });
          }
        }
      }

      for (const announcement of recentAnnouncements) {
        notifications.push({
          id: `ann-${announcement.id}`,
          type: 'ANNOUNCEMENT',
          title: announcement.title,
          message: announcement.message,
          date: announcement.createdAt,
          link: '/admin/announcements',
          read: false,
        });
      }
    } else if (userRole === 'MEMBER') {
      const [memberProfile, recentAnnouncements] = await this.repo.fetchMemberNotificationsContext(
        userId,
        todayStart,
        branchId
      );

      if (memberProfile) {
        const [myPendingInvoices, myPendingSubs, myExpiringSubscriptions] =
          await this.repo.fetchMemberNotificationsAlerts(memberProfile.id, threeDaysFromNow);

        const seenMySubIds = new Set<string>();

        for (const invoice of myPendingInvoices) {
          if (invoice.subscriptionId) seenMySubIds.add(invoice.subscriptionId);
          notifications.push({
            id: `inv-${invoice.id}`,
            type: 'PAYMENT',
            title: 'Pending Payment',
            message: `You have a pending invoice of ₹${invoice.totalAmount}. Please complete your payment.`,
            date: invoice.createdAt,
            link: '/member/subscriptions',
            read: false,
          });
        }

        for (const sub of myPendingSubs) {
          if (seenMySubIds.has(sub.id)) continue;
          const amount = sub.balanceAmount > 0 ? sub.balanceAmount : sub.plan?.price || 0;
          notifications.push({
            id: `sub-pay-${sub.id}`,
            type: 'PAYMENT',
            title: 'Pending Plan Payment',
            message: `You have a pending payment of ₹${amount} for your ${sub.plan?.name || 'membership'} plan.`,
            date: sub.createdAt,
            link: '/member/subscriptions',
            read: false,
          });
        }

        for (const sub of myExpiringSubscriptions) {
          const isExpired = sub.endDate < now;
          notifications.push({
            id: `sub-${sub.id}`,
            type: 'EXPIRY',
            title: isExpired ? 'Membership Expired' : 'Membership Expiring Soon',
            message: `Your ${sub.plan?.name || 'membership'} plan ${isExpired ? 'expired on' : 'will expire on'} ${sub.endDate.toLocaleDateString()}. Please renew it to continue accessing the gym.`,
            date: sub.endDate,
            link: '/member/subscriptions',
            read: false,
          });
        }
      }

      for (const announcement of recentAnnouncements) {
        notifications.push({
          id: `ann-${announcement.id}`,
          type: 'ANNOUNCEMENT',
          title: announcement.title,
          message: announcement.message,
          date: announcement.createdAt,
          link: '/member/dashboard',
          read: false,
        });
      }
    } else {
      const recentAnnouncements = await this.repo.fetchTodayAnnouncements(todayStart);
      for (const announcement of recentAnnouncements) {
        notifications.push({
          id: `ann-${announcement.id}`,
          type: 'ANNOUNCEMENT',
          title: announcement.title,
          message: announcement.message,
          date: announcement.createdAt,
          link: '/admin/announcements',
          read: false,
        });
      }
    }

    notifications.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return notifications;
  }

  async getOperationalAnalytics(branchId?: string | null) {
    const cacheKey = scopedCacheKey(CACHE_KEYS.OPERATIONAL_ANALYTICS, branchId);
    const cached = await memoryCache.getDistributed<any>(cacheKey, 30);
    if (cached) return cached;

    if (typeof this.repo.fetchOperationalAnalyticsInputs !== 'function') {
      return null;
    }

    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const prev30DaysStart = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const [activeAdminSessions, membersLast30Days, membersPrev30Days, allSubs, recentAttendances] =
      await this.repo.fetchOperationalAnalyticsInputs({
        branchId,
        now,
        last24h,
        last30Days,
        prev30DaysStart,
      });

    const dailyActiveAdminSessions = new Set(activeAdminSessions.map((s) => s.userId)).size;

    const growthPercent =
      membersPrev30Days > 0
        ? Math.round(((membersLast30Days - membersPrev30Days) / membersPrev30Days) * 1000) / 10
        : membersLast30Days > 0
        ? 100
        : 0;

    // Derive renewal & expiration rates across closed/active subscriptions per member
    const subsByMember = new Map<string, number>();
    let activeCount = 0;
    let expiredCount = 0;
    for (const sub of allSubs) {
      subsByMember.set(sub.memberId, (subsByMember.get(sub.memberId) ?? 0) + 1);
      if (sub.status === 'ACTIVE' && sub.endDate >= now) {
        activeCount += 1;
      } else if (sub.status === 'EXPIRED' || sub.endDate < now) {
        expiredCount += 1;
      }
    }
    const membersWithSubs = subsByMember.size;
    let renewedMembers = 0;
    for (const count of subsByMember.values()) {
      if (count > 1) renewedMembers += 1;
    }
    const renewalRatePercent =
      membersWithSubs > 0 ? Math.round((renewedMembers / membersWithSubs) * 1000) / 10 : 0;
    const totalOutcomeSubs = activeCount + expiredCount;
    const expirationRatePercent =
      totalOutcomeSubs > 0 ? Math.round((expiredCount / totalOutcomeSubs) * 1000) / 10 : 0;

    // Hourly attendance histogram (last 30d) for peak studio hours
    const hourCounts = new Array<number>(24).fill(0);
    for (const entry of recentAttendances) {
      const hr = new Date(entry.checkIn).getHours();
      if (hr >= 0 && hr < 24) hourCounts[hr] += 1;
    }
    const peakUsageHours = hourCounts
      .map((checkIns, hour) => ({
        hour: `${String(hour).padStart(2, '0')}:00`,
        checkIns,
      }))
      .filter((bucket) => bucket.checkIns > 0)
      .sort((a, b) => b.checkIns - a.checkIns)
      .slice(0, 4);

    const analyticsPayload = {
      dailyActiveAdminSessions,
      memberGrowthVelocity: {
        last30Days: membersLast30Days,
        prev30Days: membersPrev30Days,
        growthPercent,
        avgPerWeek: Math.round((membersLast30Days / 4.28) * 10) / 10,
      },
      renewalExpirationTrends: {
        activeSubscriptions: activeCount,
        expiredSubscriptions: expiredCount,
        renewalRatePercent,
        expirationRatePercent,
      },
      peakUsageHours,
    };

    memoryCache.set(cacheKey, analyticsPayload, 30);
    return analyticsPayload;
  }
}

export const analyticsService = new AnalyticsService();
