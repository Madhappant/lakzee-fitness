/* eslint-disable @typescript-eslint/no-explicit-any */
import { PrismaClient } from '@prisma/client';
import { prisma } from '../config/prisma';
import { buildBranchWhere, PRIMARY_BRANCH_ID } from '../utils/tenant';

export class MemberRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  findAllMemberIds(branchId?: string | null) {
    return this.db.memberProfile.findMany({
      ...(branchId ? { where: buildBranchWhere(branchId) } : {}),
      select: { memberId: true },
    });
  }

  findProfileByMemberId(memberId: string, branchId?: string | null) {
    const profileDelegate = this.db.memberProfile as any;
    if (typeof profileDelegate.findFirst === 'function') {
      return profileDelegate.findFirst({
        where: { memberId, ...buildBranchWhere(branchId) },
        select: { id: true, userId: true, branchId: true },
      });
    }
    return this.db.memberProfile.findUnique({
      where: { memberId } as any,
      select: { id: true, userId: true },
    });
  }

  findUserByEmail(email: string) {
    return this.db.user.findUnique({
      where: { email },
      select: {
        id: true,
        branchId: true,
        firstName: true,
        lastName: true,
        phone: true,
        memberProfile: { select: { id: true, branchId: true, address: true } },
      },
    });
  }

  createMemberWithProfile(input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
    branchId?: string;
    memberId: string;
    whatsappNumber?: string;
    notificationsEnabled?: boolean;
    gender?: 'MALE' | 'FEMALE' | 'OTHER';
    dob?: Date;
    bloodGroup?: string;
    address?: string;
    emergencyContact?: string;
    photoUrl?: string;
  }) {
    const {
      branchId,
      memberId,
      whatsappNumber,
      notificationsEnabled,
      gender,
      dob,
      bloodGroup,
      address,
      emergencyContact,
      photoUrl,
      ...userFields
    } = input;
    const resolvedBranchId = branchId ?? PRIMARY_BRANCH_ID;
    return this.db.user.create({
      data: {
        ...userFields,
        branchId: resolvedBranchId,
        role: 'MEMBER',
        memberProfile: {
          create: {
            branchId: resolvedBranchId,
            memberId,
            whatsappNumber,
            notificationsEnabled: notificationsEnabled ?? true,
            gender,
            dob,
            bloodGroup,
            address,
            emergencyContact,
            photoUrl,
          },
        },
      },
      include: { memberProfile: true },
      omit: {
        password: true,
        resetOtp: true,
        resetOtpExpiry: true,
        phoneOtp: true,
        phoneOtpExpiry: true,
      },
    });
  }

  countMembers(branchId?: string | null) {
    return this.db.user.count({
      where: {
        role: 'MEMBER',
        ...buildBranchWhere(branchId),
      },
    });
  }

  listMembers(
    orderBy: any,
    options: { branchId?: string | null; cursor?: string; limit?: number } = {}
  ) {
    const { branchId, cursor, limit } = options;
    return this.db.user.findMany({
      where: {
        role: 'MEMBER',
        ...buildBranchWhere(branchId),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        branchId: true,
        createdAt: true,
        memberProfile: {
          select: {
            id: true,
            branchId: true,
            memberId: true,
            whatsappNumber: true,
            notificationsEnabled: true,
            photoUrl: true,
            gender: true,
            bloodGroup: true,
            joiningDate: true,
            qrCode: true,
            subscriptions: {
              take: 1,
              orderBy: { createdAt: 'desc' },
              select: {
                status: true,
                endDate: true,
                plan: { select: { id: true, name: true, price: true } },
              },
            },
          },
        },
      },
      orderBy,
      ...(limit !== undefined ? { take: limit + 1 } : {}),
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
  }

  findMemberDetailById(userId: string) {
    return this.db.user.findUnique({
      where: { id: userId },
      include: { memberProfile: true, assignedMembers: true },
      omit: {
        password: true,
        resetOtp: true,
        resetOtpExpiry: true,
        phoneOtp: true,
        phoneOtpExpiry: true,
      },
    });
  }

  findMemberSummaryById(userId: string) {
    return this.db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        branchId: true,
        memberProfile: { select: { id: true, branchId: true } },
      },
    });
  }

  updateMemberUser(userId: string, data: Record<string, any>) {
    return this.db.user.update({
      where: { id: userId },
      data,
      include: { memberProfile: true },
      omit: {
        password: true,
        resetOtp: true,
        resetOtpExpiry: true,
        phoneOtp: true,
        phoneOtpExpiry: true,
      },
    });
  }

  async deleteMemberCascade(userId: string, profileId?: string) {
    await this.db.$transaction(async (tx) => {
      if (profileId) {
        const invoices = await tx.invoice.findMany({
          where: { memberId: profileId },
          select: { id: true },
        });
        const invoiceIds = invoices.map((i) => i.id);

        if (invoiceIds.length > 0) {
          await tx.payment.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
        }
        await tx.invoice.deleteMany({ where: { memberId: profileId } });
        await tx.subscription.deleteMany({ where: { memberId: profileId } });
        await tx.attendance.deleteMany({ where: { memberId: profileId } });
        await tx.dietPlan.deleteMany({ where: { memberId: profileId } });
        await tx.workoutRoutine.deleteMany({ where: { memberId: profileId } });
        await (tx as any).notificationLog?.deleteMany?.({ where: { memberId: profileId } });
        await tx.memberProfile.delete({ where: { id: profileId } });
      }

      await tx.memberProfile.updateMany({
        where: { trainerId: userId },
        data: { trainerId: null },
      });
      await tx.announcement.deleteMany({ where: { authorId: userId } });
      await tx.user.delete({ where: { id: userId } });
    });
  }

  // --- Portal & Trainer Diet/Workout Operations ---
  findProfileIdByUserId(userId: string) {
    return this.db.memberProfile.findUnique({
      where: { userId },
      select: { id: true, branchId: true },
    });
  }

  findPortalProfile(userId: string, startOfToday: Date) {
    return this.db.memberProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        trainer: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        subscriptions: {
          where: {
            status: 'ACTIVE',
            endDate: { gte: startOfToday },
          },
          include: { plan: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
  }

  listMemberAttendance(memberProfileId: string, limit = 30) {
    return this.db.attendance.findMany({
      where: { memberId: memberProfileId },
      orderBy: { checkIn: 'desc' },
      take: limit,
    });
  }

  listMemberSubscriptions(memberProfileId: string) {
    return this.db.subscription.findMany({
      where: { memberId: memberProfileId },
      orderBy: { createdAt: 'desc' },
      include: {
        plan: true,
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            totalAmount: true,
            status: true,
          },
        },
      },
    });
  }

  updateMemberPhoto(userId: string, photoUrl: string) {
    return this.db.memberProfile.update({
      where: { userId },
      data: { photoUrl },
      select: { photoUrl: true },
    });
  }

  findActiveDietPlan(memberProfileId: string) {
    return this.db.dietPlan.findFirst({
      where: { memberId: memberProfileId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  replaceActiveDietPlan(input: {
    memberProfileId: string;
    title: string;
    notes?: string;
    mealsData: string;
    assignedBy?: string;
  }) {
    return this.db.$transaction(async (tx) => {
      await tx.dietPlan.updateMany({
        where: { memberId: input.memberProfileId, isActive: true },
        data: { isActive: false },
      });

      return tx.dietPlan.create({
        data: {
          memberId: input.memberProfileId,
          title: input.title,
          notes: input.notes,
          mealsData: input.mealsData,
          assignedBy: input.assignedBy,
        },
      });
    });
  }

  findActiveWorkoutRoutine(memberProfileId: string) {
    return this.db.workoutRoutine.findFirst({
      where: { memberId: memberProfileId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  replaceActiveWorkoutRoutine(input: {
    memberProfileId: string;
    title: string;
    notes?: string;
    exercisesData: string;
    assignedBy?: string;
  }) {
    return this.db.$transaction(async (tx) => {
      await tx.workoutRoutine.updateMany({
        where: { memberId: input.memberProfileId, isActive: true },
        data: { isActive: false },
      });

      return tx.workoutRoutine.create({
        data: {
          memberId: input.memberProfileId,
          title: input.title,
          notes: input.notes,
          exercisesData: input.exercisesData,
          assignedBy: input.assignedBy,
        },
      });
    });
  }
}

export const memberRepository = new MemberRepository();
