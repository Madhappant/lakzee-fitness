/* eslint-disable @typescript-eslint/no-explicit-any */
import { PrismaClient } from '@prisma/client';
import { prisma } from '../config/prisma';
import { buildBranchWhere, PRIMARY_BRANCH_ID } from '../utils/tenant';

export class StudioRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  async getOrCreateSettings(branchId?: string | null) {
    const resolvedBranchId = branchId || PRIMARY_BRANCH_ID;
    const settingsDelegate = (this.db as unknown as { settings?: typeof this.db.settings }).settings;
    if (!settingsDelegate) {
      return {
        id: resolvedBranchId === PRIMARY_BRANCH_ID ? '1' : `settings-${resolvedBranchId}`,
        branchId: resolvedBranchId,
        gymName: 'Lakzee Fitness Studio',
      };
    }

    let settings =
      resolvedBranchId === PRIMARY_BRANCH_ID
        ? await settingsDelegate.findUnique({ where: { id: '1' } })
        : await settingsDelegate.findFirst({ where: { branchId: resolvedBranchId } });

    if (!settings) {
      settings = await settingsDelegate.create({
        data: {
          id: resolvedBranchId === PRIMARY_BRANCH_ID ? '1' : `settings-${resolvedBranchId}`,
          branchId: resolvedBranchId,
          gymName: 'Lakzee Fitness Studio',
        },
      });
    }
    return settings;
  }

  upsertSettings(validated: Record<string, any>, branchId?: string | null) {
    const resolvedBranchId = branchId || PRIMARY_BRANCH_ID;
    const settingsId = resolvedBranchId === PRIMARY_BRANCH_ID ? '1' : `settings-${resolvedBranchId}`;
    return this.db.settings.upsert({
      where: { id: settingsId },
      update: { ...validated, branchId: resolvedBranchId },
      create: {
        id: settingsId,
        branchId: resolvedBranchId,
        gymName: validated.gymName || 'Lakzee Fitness Studio',
        ...validated,
      },
    });
  }

  listAnnouncements(limit = 50, branchId?: string | null) {
    return this.db.announcement.findMany({
      where: buildBranchWhere(branchId),
      take: limit,
      include: {
        author: {
          select: { firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  findAnnouncementById(id: string) {
    return this.db.announcement.findUnique({
      where: { id },
      select: { id: true, branchId: true },
    });
  }

  createAnnouncement(data: { title: string; message: string; authorId: string; branchId?: string }) {
    return this.db.announcement.create({
      data: {
        ...data,
        branchId: data.branchId ?? PRIMARY_BRANCH_ID,
      },
      include: {
        author: {
          select: { firstName: true, lastName: true },
        },
      },
    });
  }

  deleteAnnouncement(id: string) {
    return this.db.announcement.delete({ where: { id } });
  }

  createConsultationInquiry(data: {
    branchId?: string;
    name: string;
    phone: string;
    email: string | null;
    goal: string;
    message: string | null;
  }) {
    return this.db.consultationInquiry.create({
      data: {
        ...data,
        branchId: data.branchId ?? PRIMARY_BRANCH_ID,
      },
      select: { id: true },
    });
  }
}

export const studioRepository = new StudioRepository();
