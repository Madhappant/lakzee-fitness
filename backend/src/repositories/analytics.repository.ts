import { PrismaClient } from '@prisma/client';
import { prisma } from '../config/prisma';
import { buildBranchWhere } from '../utils/tenant';

export class AnalyticsRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  fetchDashboardInputs(params: {
    branchId?: string | null;
    today: Date;
    firstDayOfMonth: Date;
    sevenDaysFromNow: Date;
    revenueWindowStart: Date;
  }) {
    const { branchId, today, firstDayOfMonth, sevenDaysFromNow, revenueWindowStart } = params;
    const branchWhere = buildBranchWhere(branchId);

    return Promise.all([
      this.db.memberProfile.findMany({
        where: {
          ...branchWhere,
          subscriptions: {
            some: { endDate: { gte: today }, status: 'ACTIVE' },
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
      this.db.attendance.count({
        where: { date: { gte: today }, ...branchWhere },
      }),
      this.db.memberProfile.findMany({
        where: {
          ...branchWhere,
          user: { role: 'MEMBER', createdAt: { gte: firstDayOfMonth } },
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
      this.db.subscription.findMany({
        where: { createdAt: { gte: revenueWindowStart }, ...branchWhere },
        select: {
          createdAt: true,
          paymentStatus: true,
          balanceAmount: true,
          plan: { select: { price: true } },
        },
      }),
      this.db.attendance.findMany({
        where: branchWhere,
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
      this.db.subscription.findMany({
        where: {
          ...branchWhere,
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
      this.db.subscription.findMany({
        where: {
          AND: [
            branchWhere,
            { OR: [{ status: 'EXPIRED' }, { endDate: { lt: today } }] },
          ],
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
      this.db.memberProfile.findMany({
        where: { dob: { not: null }, ...branchWhere },
        select: {
          id: true,
          memberId: true,
          dob: true,
          user: { select: { firstName: true, lastName: true } },
        },
      }),
      this.db.subscription.findMany({
        where: branchWhere,
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
      this.db.subscription.findMany({
        where: { paymentStatus: 'PENDING', ...branchWhere },
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
  }

  fetchReportsInputs(params: {
    branchId?: string | null;
    now: Date;
    thirtyDaysAgo: Date;
    sixDaysAgo: Date;
  }) {
    const { branchId, now, thirtyDaysAgo, sixDaysAgo } = params;
    const branchWhere = buildBranchWhere(branchId);

    return Promise.all([
      this.db.subscription.findMany({
        where: branchWhere,
        select: {
          id: true,
          status: true,
          paymentStatus: true,
          paymentMethod: true,
          balanceAmount: true,
          startDate: true,
          endDate: true,
          createdAt: true,
          plan: { select: { name: true, price: true } },
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
      this.db.memberProfile.findMany({
        where: {
          ...branchWhere,
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
      this.db.attendance.count({ where: { checkIn: { gte: thirtyDaysAgo }, ...branchWhere } }),
      this.db.attendance.findMany({
        where: { checkIn: { gte: sixDaysAgo }, ...branchWhere },
        select: { checkIn: true },
      }),
    ]);
  }

  fetchTodayAnnouncements(todayStart: Date, branchId?: string | null) {
    return this.db.announcement.findMany({
      where: { createdAt: { gte: todayStart }, ...buildBranchWhere(branchId) },
      select: { id: true, title: true, message: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  fetchStaffNotificationsData(params: {
    branchId?: string | null;
    todayStart: Date;
    threeDaysFromNow: Date;
    includeBirthdays: boolean;
  }) {
    const { branchId, todayStart, threeDaysFromNow, includeBirthdays } = params;
    const branchWhere = buildBranchWhere(branchId);

    return Promise.all([
      this.db.invoice.findMany({
        where: { status: 'PENDING', ...branchWhere },
        select: {
          id: true,
          memberId: true,
          totalAmount: true,
          createdAt: true,
          member: { select: { user: { select: { firstName: true, lastName: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.db.subscription.findMany({
        where: { paymentStatus: 'PENDING', ...branchWhere },
        select: {
          id: true,
          memberId: true,
          balanceAmount: true,
          createdAt: true,
          plan: { select: { name: true, price: true } },
          member: { select: { user: { select: { firstName: true, lastName: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.db.subscription.findMany({
        where: {
          ...branchWhere,
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
      includeBirthdays
        ? this.db.memberProfile.findMany({
            where: { dob: { not: null }, ...branchWhere },
            select: {
              id: true,
              userId: true,
              dob: true,
              user: { select: { firstName: true, lastName: true } },
            },
          })
        : Promise.resolve([]),
      this.fetchTodayAnnouncements(todayStart, branchId),
    ]);
  }

  fetchMemberNotificationsContext(userId: string, todayStart: Date, branchId?: string | null) {
    return Promise.all([
      this.db.memberProfile.findUnique({ where: { userId }, select: { id: true, branchId: true } }),
      this.fetchTodayAnnouncements(todayStart, branchId),
    ]);
  }

  fetchMemberNotificationsAlerts(memberProfileId: string, threeDaysFromNow: Date) {
    return Promise.all([
      this.db.invoice.findMany({
        where: { memberId: memberProfileId, status: 'PENDING' },
        select: { id: true, subscriptionId: true, totalAmount: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.db.subscription.findMany({
        where: { memberId: memberProfileId, paymentStatus: 'PENDING' },
        select: {
          id: true,
          balanceAmount: true,
          createdAt: true,
          plan: { select: { name: true, price: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.db.subscription.findMany({
        where: {
          memberId: memberProfileId,
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
  }

  fetchOperationalAnalyticsInputs(params: {
    branchId?: string | null;
    now: Date;
    last24h: Date;
    last30Days: Date;
    prev30DaysStart: Date;
  }) {
    const { branchId, now, last24h, last30Days, prev30DaysStart } = params;
    const branchWhere = buildBranchWhere(branchId);

    return Promise.all([
      this.db.refreshSession
        .findMany({
          where: {
            revokedAt: null,
            expiresAt: { gte: now },
            createdAt: { gte: last24h },
            user: {
              ...branchWhere,
              role: { in: ['SUPER_ADMIN', 'BRANCH_ADMIN', 'ADMIN', 'RECEPTIONIST', 'TRAINER', 'STAFF'] },
            },
          },
          select: { userId: true },
        })
        .catch(() => []),
      this.db.user.count({
        where: { role: 'MEMBER', createdAt: { gte: last30Days }, ...branchWhere },
      }),
      this.db.user.count({
        where: { role: 'MEMBER', createdAt: { gte: prev30DaysStart, lt: last30Days }, ...branchWhere },
      }),
      this.db.subscription.findMany({
        where: branchWhere,
        select: { status: true, memberId: true, endDate: true, createdAt: true },
      }),
      this.db.attendance.findMany({
        where: { checkIn: { gte: last30Days }, ...branchWhere },
        select: { checkIn: true },
      }),
    ]);
  }
}

export const analyticsRepository = new AnalyticsRepository();
