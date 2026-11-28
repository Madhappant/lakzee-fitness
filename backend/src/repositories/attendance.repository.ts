/* eslint-disable @typescript-eslint/no-explicit-any */
import { PrismaClient } from '@prisma/client';
import { prisma } from '../config/prisma';
import { buildBranchWhere, PRIMARY_BRANCH_ID } from '../utils/tenant';

function scopeOrQuery(branchId: string | null | undefined, orClauses: Record<string, any>[]) {
  const branchWhere = buildBranchWhere(branchId);
  if (Object.keys(branchWhere).length === 0) {
    return { OR: orClauses };
  }
  return { AND: [branchWhere, { OR: orClauses }] };
}

export class AttendanceRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  findMembersByExactIdentifier(sanitizedId: string, branchId?: string | null) {
    return this.db.memberProfile.findMany({
      where: scopeOrQuery(branchId, [
        { memberId: { equals: sanitizedId, mode: 'insensitive' } },
        { qrCode: { equals: sanitizedId, mode: 'insensitive' } },
      ]),
      select: {
        id: true,
        branchId: true,
        memberId: true,
        user: { select: { firstName: true, lastName: true } },
      },
    });
  }

  findMembersByNameFragment(sanitizedId: string, branchId?: string | null) {
    return this.db.memberProfile.findMany({
      where: scopeOrQuery(branchId, [
        { user: { firstName: { contains: sanitizedId, mode: 'insensitive' } } },
        { user: { lastName: { contains: sanitizedId, mode: 'insensitive' } } },
      ]),
      select: {
        id: true,
        branchId: true,
        memberId: true,
        user: { select: { firstName: true, lastName: true } },
      },
    });
  }

  findMemberByQrCodeUnscoped(qrCode: string) {
    return this.db.memberProfile.findFirst({
      where: { qrCode: { equals: qrCode, mode: 'insensitive' } },
      select: { id: true, branchId: true },
    });
  }

  findCheckInPreconditions(memberProfileId: string, startOfToday: Date) {
    return Promise.all([
      this.db.subscription.findFirst({
        where: {
          memberId: memberProfileId,
          status: 'ACTIVE',
          endDate: { gte: startOfToday },
        },
        select: { id: true },
      }),
      this.db.attendance.findFirst({
        where: {
          memberId: memberProfileId,
          checkOut: null,
        },
        orderBy: { checkIn: 'desc' },
        select: { id: true, checkIn: true },
      }),
    ]);
  }

  recordCheckInTransaction(
    memberProfileId: string,
    now: Date,
    autoCloseSession?: { attendanceId: string; autoCheckOutAt: Date },
    branchId?: string | null
  ) {
    return this.db.$transaction(async (tx) => {
      if (autoCloseSession) {
        await tx.attendance.update({
          where: { id: autoCloseSession.attendanceId },
          data: { checkOut: autoCloseSession.autoCheckOutAt },
        });
      }

      return tx.attendance.create({
        data: {
          branchId: branchId ?? PRIMARY_BRANCH_ID,
          memberId: memberProfileId,
          date: now,
        },
      });
    });
  }

  findLatestOpenSessionId(memberProfileId: string) {
    return this.db.attendance.findFirst({
      where: {
        memberId: memberProfileId,
        checkOut: null,
      },
      orderBy: { checkIn: 'desc' },
      select: { id: true },
    });
  }

  completeCheckOut(attendanceId: string, checkOutAt: Date) {
    return this.db.attendance.update({
      where: { id: attendanceId },
      data: { checkOut: checkOutAt },
    });
  }

  listAttendanceLogs(whereClause: Record<string, any>) {
    return this.db.attendance.findMany({
      where: whereClause,
      select: {
        id: true,
        branchId: true,
        memberId: true,
        checkIn: true,
        checkOut: true,
        date: true,
        member: {
          select: {
            id: true,
            branchId: true,
            memberId: true,
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
      orderBy: { checkIn: 'desc' },
    });
  }
}

export const attendanceRepository = new AttendanceRepository();
