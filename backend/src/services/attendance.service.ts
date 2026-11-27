import { PrismaClient } from '@prisma/client';
import { invalidateCacheScopes } from '../utils/cache';
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors';

const SESSION_WINDOW_HOURS = 16;
const AUTO_CHECKOUT_DURATION_MS = 2 * 60 * 60 * 1000;

export type OpenSessionDecision =
  | { action: 'ALLOW' }
  | { action: 'REJECT_ALREADY_CHECKED_IN' }
  | { action: 'AUTO_CLOSE'; attendanceId: string; autoCheckOutAt: Date };

export function evaluateCheckInWindow(
  now: Date,
  openCheckIn: { id: string; checkIn: Date } | null
): OpenSessionDecision {
  if (!openCheckIn) {
    return { action: 'ALLOW' };
  }

  const checkInDate = new Date(openCheckIn.checkIn);
  const diffHours = (now.getTime() - checkInDate.getTime()) / (1000 * 60 * 60);

  if (diffHours < SESSION_WINDOW_HOURS) {
    return { action: 'REJECT_ALREADY_CHECKED_IN' };
  }

  return {
    action: 'AUTO_CLOSE',
    attendanceId: openCheckIn.id,
    autoCheckOutAt: new Date(checkInDate.getTime() + AUTO_CHECKOUT_DURATION_MS),
  };
}

export async function findMemberByIdentifier(db: PrismaClient, sanitizedId: string) {
  const exactMatches = await db.memberProfile.findMany({
    where: {
      OR: [
        { memberId: { equals: sanitizedId, mode: 'insensitive' } },
        { qrCode: { equals: sanitizedId, mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      memberId: true,
      user: { select: { firstName: true, lastName: true } },
    },
  });

  if (exactMatches.length > 0) {
    return exactMatches;
  }

  if (sanitizedId.length < 2) {
    return [];
  }

  return db.memberProfile.findMany({
    where: {
      OR: [
        { user: { firstName: { contains: sanitizedId, mode: 'insensitive' } } },
        { user: { lastName: { contains: sanitizedId, mode: 'insensitive' } } },
      ],
    },
    select: {
      id: true,
      memberId: true,
      user: { select: { firstName: true, lastName: true } },
    },
  });
}

async function resolveUniqueMember(db: PrismaClient, rawIdentifier: unknown) {
  if (!rawIdentifier || typeof rawIdentifier !== 'string' || !rawIdentifier.trim()) {
    throw new BadRequestError('Member ID or QR code is required');
  }
  const sanitizedId = rawIdentifier.trim();
  const members = await findMemberByIdentifier(db, sanitizedId);

  if (members.length === 0) {
    throw new NotFoundError('Member not found');
  }
  if (members.length > 1) {
    throw new BadRequestError('Multiple members found. Please use exact ID or scan QR.');
  }
  return members[0];
}

export async function performMemberCheckIn(db: PrismaClient, rawIdentifier: unknown, now = new Date()) {
  const member = await resolveUniqueMember(db, rawIdentifier);

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  // Run active subscription verification & latest open session query in parallel
  const [activeSub, existingCheckIn] = await Promise.all([
    db.subscription.findFirst({
      where: {
        memberId: member.id,
        status: 'ACTIVE',
        endDate: { gte: startOfToday },
      },
      select: { id: true },
    }),
    db.attendance.findFirst({
      where: {
        memberId: member.id,
        checkOut: null,
      },
      orderBy: { checkIn: 'desc' },
      select: { id: true, checkIn: true },
    }),
  ]);

  if (!activeSub) {
    throw new ForbiddenError('Member does not have an active non-expired subscription');
  }

  const decision = evaluateCheckInWindow(now, existingCheckIn);
  if (decision.action === 'REJECT_ALREADY_CHECKED_IN') {
    throw new BadRequestError('Member is already checked in and has not checked out');
  }

  const attendance = await db.$transaction(async (tx) => {
    if (decision.action === 'AUTO_CLOSE') {
      await tx.attendance.update({
        where: { id: decision.attendanceId },
        data: { checkOut: decision.autoCheckOutAt },
      });
    }

    return tx.attendance.create({
      data: {
        memberId: member.id,
        date: now,
      },
    });
  });

  invalidateCacheScopes('dashboard', 'reports');

  return {
    memberName: `${member.user.firstName} ${member.user.lastName}`,
    attendance,
  };
}

export async function performMemberCheckOut(db: PrismaClient, rawIdentifier: unknown, now = new Date()) {
  const member = await resolveUniqueMember(db, rawIdentifier);

  const existingCheckIn = await db.attendance.findFirst({
    where: {
      memberId: member.id,
      checkOut: null,
    },
    orderBy: { checkIn: 'desc' },
    select: { id: true },
  });

  if (!existingCheckIn) {
    throw new BadRequestError('Member is not checked in or already checked out');
  }

  const attendance = await db.attendance.update({
    where: { id: existingCheckIn.id },
    data: { checkOut: now },
  });

  invalidateCacheScopes('dashboard', 'reports');

  return {
    memberName: `${member.user.firstName} ${member.user.lastName}`,
    attendance,
  };
}
