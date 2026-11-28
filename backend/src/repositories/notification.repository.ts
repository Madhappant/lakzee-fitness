/* eslint-disable @typescript-eslint/no-explicit-any */
import { PrismaClient } from '@prisma/client';
import { prisma } from '../config/prisma';
import { buildBranchWhere, PRIMARY_BRANCH_ID } from '../utils/tenant';

export interface NotificationLogCreateInput {
  branchId: string;
  memberId: string;
  channel: string;
  milestone: string;
  cycleExpiryDate: Date;
  status: string;
  providerMessageId?: string | null;
  errorMessage?: string | null;
  sentAt?: Date;
}

export class NotificationRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  findCandidateSubscriptions(rangeStart: Date, rangeEnd: Date, branchId?: string | null) {
    return this.db.subscription.findMany({
      where: {
        status: { in: ['ACTIVE', 'EXPIRED'] },
        endDate: { gte: rangeStart, lte: rangeEnd },
        ...(branchId ? buildBranchWhere(branchId) : {}),
      },
      include: {
        plan: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true, code: true } },
        member: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                branchId: true,
              },
            },
          },
        },
      },
    });
  }

  async findMemberContextByAnyId(memberIdOrUserId: string) {
    let profile = await this.db.memberProfile.findUnique({
      where: { id: memberIdOrUserId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            branchId: true,
          },
        },
        subscriptions: {
          orderBy: { endDate: 'desc' },
          take: 1,
          include: { plan: { select: { id: true, name: true } } },
        },
      },
    });

    if (!profile) {
      profile = await this.db.memberProfile.findUnique({
        where: { userId: memberIdOrUserId },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              branchId: true,
            },
          },
          subscriptions: {
            orderBy: { endDate: 'desc' },
            take: 1,
            include: { plan: { select: { id: true, name: true } } },
          },
        },
      });
    }

    if (!profile) return null;

    const branchId = profile.branchId ?? profile.user?.branchId ?? PRIMARY_BRANCH_ID;
    const branch = await this.db.branch.findUnique({ where: { id: branchId } }).catch(() => null);
    return { ...profile, branch };
  }

  async findBranchSettings(branchId?: string | null) {
    const resolvedBranchId = branchId || PRIMARY_BRANCH_ID;
    const settingsDelegate = (this.db as unknown as { settings?: typeof this.db.settings }).settings;
    if (!settingsDelegate) {
      return null;
    }

    const row =
      resolvedBranchId === PRIMARY_BRANCH_ID
        ? await settingsDelegate.findUnique({ where: { id: '1' } })
        : await settingsDelegate.findFirst({ where: { branchId: resolvedBranchId } });
    return row ?? null;
  }

  findExistingDelivery(params: {
    memberId: string;
    channel: string;
    milestone: string;
    cycleExpiryDate: Date;
  }) {
    return this.db.notificationLog.findUnique({
      where: {
        memberId_channel_milestone_cycleExpiryDate: {
          memberId: params.memberId,
          channel: params.channel,
          milestone: params.milestone,
          cycleExpiryDate: params.cycleExpiryDate,
        },
      },
    });
  }

  createNotificationLog(input: NotificationLogCreateInput) {
    return this.db.notificationLog.create({
      data: {
        branchId: input.branchId || PRIMARY_BRANCH_ID,
        memberId: input.memberId,
        channel: input.channel,
        milestone: input.milestone,
        cycleExpiryDate: input.cycleExpiryDate,
        status: input.status,
        providerMessageId: input.providerMessageId ?? null,
        errorMessage: input.errorMessage ?? null,
        sentAt: input.sentAt ?? new Date(),
      },
    });
  }

  updateNotificationLog(
    id: string,
    data: {
      status: string;
      providerMessageId?: string | null;
      errorMessage?: string | null;
      sentAt?: Date;
    }
  ) {
    return this.db.notificationLog.update({
      where: { id },
      data: {
        status: data.status,
        providerMessageId: data.providerMessageId ?? null,
        errorMessage: data.errorMessage ?? null,
        sentAt: data.sentAt ?? new Date(),
      },
    });
  }

  findNotificationLogById(id: string) {
    return this.db.notificationLog.findUnique({
      where: { id },
      include: {
        branch: { select: { id: true, name: true, code: true } },
        member: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
              },
            },
          },
        },
      },
    });
  }

  listNotificationLogs(options: {
    branchId?: string | null;
    status?: string;
    channel?: string;
    memberId?: string;
    limit?: number;
  } = {}) {
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
    const where: Record<string, any> = {
      ...(options.branchId ? buildBranchWhere(options.branchId) : {}),
      ...(options.status ? { status: options.status } : {}),
      ...(options.channel ? { channel: options.channel } : {}),
      ...(options.memberId ? { memberId: options.memberId } : {}),
    };

    return this.db.notificationLog.findMany({
      ...(Object.keys(where).length > 0 ? { where } : {}),
      orderBy: { sentAt: 'desc' },
      take: limit,
      include: {
        branch: { select: { id: true, name: true, code: true } },
        member: {
          select: {
            id: true,
            memberId: true,
            whatsappNumber: true,
            notificationsEnabled: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
              },
            },
          },
        },
      },
    });
  }
}

export const notificationRepository = new NotificationRepository();
