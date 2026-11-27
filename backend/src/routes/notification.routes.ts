/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, Response } from 'express';
import { prisma } from '../app';
import { authenticate, AuthRequest } from '../middlewares/auth.middleware';
import { asyncHandler } from '../middlewares/error.middleware';

const router = Router();

router.get(
  '/',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userRole = req.user!.role;
    const userId = req.user!.id;

    const notifications: any[] = [];
    let now = new Date();

    if (req.query.tzOffset) {
      const offset = parseInt(req.query.tzOffset as string, 10);
      if (!isNaN(offset)) {
        now = new Date(Date.now() - offset * 60000);
      }
    }

    const threeDaysFromNow = new Date(now);
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    // Fetch today's announcements in parallel across all roles
    const announcementsPromise = prisma.announcement.findMany({
      where: { createdAt: { gte: todayStart } },
      select: { id: true, title: true, message: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    if (userRole === 'ADMIN' || userRole === 'RECEPTIONIST') {
      const [
        pendingInvoices,
        pendingSubs,
        expiringSubscriptions,
        membersWithBirthdays,
        recentAnnouncements,
      ] = await Promise.all([
        prisma.invoice.findMany({
          where: { status: 'PENDING' },
          select: {
            id: true,
            memberId: true,
            totalAmount: true,
            createdAt: true,
            member: {
              select: {
                user: { select: { firstName: true, lastName: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.subscription.findMany({
          where: { paymentStatus: 'PENDING' },
          select: {
            id: true,
            memberId: true,
            balanceAmount: true,
            createdAt: true,
            plan: { select: { name: true, price: true } },
            member: {
              select: {
                user: { select: { firstName: true, lastName: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.subscription.findMany({
          where: {
            endDate: { lte: threeDaysFromNow },
            status: { notIn: ['CANCELLED', 'FROZEN'] },
          },
          select: {
            id: true,
            endDate: true,
            plan: { select: { name: true } },
            member: {
              select: {
                userId: true,
                user: { select: { firstName: true, lastName: true } },
              },
            },
          },
          orderBy: { endDate: 'asc' },
        }),
        userRole === 'ADMIN'
          ? prisma.memberProfile.findMany({
              where: { dob: { not: null } },
              select: {
                id: true,
                userId: true,
                dob: true,
                user: { select: { firstName: true, lastName: true } },
              },
            })
          : Promise.resolve([]),
        announcementsPromise,
      ]);

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
        // Fix: /admin/members/[id]/plan expects User ID, not MemberProfile ID
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

      if (userRole === 'ADMIN') {
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
      const [memberProfile, recentAnnouncements] = await Promise.all([
        prisma.memberProfile.findUnique({ where: { userId }, select: { id: true } }),
        announcementsPromise,
      ]);

      if (memberProfile) {
        const [myPendingInvoices, myPendingSubs, myExpiringSubscriptions] = await Promise.all([
          prisma.invoice.findMany({
            where: { memberId: memberProfile.id, status: 'PENDING' },
            select: { id: true, subscriptionId: true, totalAmount: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
          }),
          prisma.subscription.findMany({
            where: { memberId: memberProfile.id, paymentStatus: 'PENDING' },
            select: {
              id: true,
              balanceAmount: true,
              createdAt: true,
              plan: { select: { name: true, price: true } },
            },
            orderBy: { createdAt: 'desc' },
          }),
          prisma.subscription.findMany({
            where: {
              memberId: memberProfile.id,
              endDate: { lte: threeDaysFromNow },
              status: { notIn: ['CANCELLED', 'FROZEN'] },
            },
            select: {
              id: true,
              endDate: true,
              plan: { select: { name: true } },
            },
            orderBy: { endDate: 'asc' },
          }),
        ]);

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
      const recentAnnouncements = await announcementsPromise;
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

    res.status(200).json({
      status: 'success',
      data: notifications,
    });
  })
);

export default router;
