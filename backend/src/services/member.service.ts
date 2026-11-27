import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { invalidateCacheScopes } from '../utils/cache';
import { BadRequestError, NotFoundError } from '../utils/errors';

export type MemberSortOrder = 'asc' | 'desc' | 'latest';

const naturalIdCollator = new Intl.Collator('en', {
  numeric: true,
  sensitivity: 'base',
});

export function parseMemberSortOrder(raw: unknown): MemberSortOrder {
  if (raw === 'desc' || raw === 'latest') {
    return raw;
  }
  return 'asc';
}

export function compareMemberIds(aRaw?: string | null, bRaw?: string | null): number {
  const a = (aRaw ?? '').trim();
  const b = (bRaw ?? '').trim();
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;

  const cmp = naturalIdCollator.compare(a, b);
  if (cmp !== 0) return cmp;
  // Deterministic tie-breaker when numeric values match (e.g. "002" vs "2")
  return a.localeCompare(b);
}

function toTimestamp(val: Date | string | null | undefined): number | null {
  if (!val) return null;
  const ms = val instanceof Date ? val.getTime() : Date.parse(val);
  return Number.isFinite(ms) ? ms : null;
}

export interface SortableMemberShape {
  id: string;
  createdAt?: Date | string | null;
  memberProfile?: {
    memberId?: string | null;
    joiningDate?: Date | string | null;
  } | null;
}

export function sortMembers<T extends SortableMemberShape>(
  members: readonly T[],
  sortOrder: MemberSortOrder = 'asc'
): T[] {
  return [...members].sort((a, b) => {
    const aId = a.memberProfile?.memberId;
    const bId = b.memberProfile?.memberId;

    if (sortOrder === 'latest') {
      const aTime = toTimestamp(a.createdAt ?? a.memberProfile?.joiningDate);
      const bTime = toTimestamp(b.createdAt ?? b.memberProfile?.joiningDate);
      if (aTime !== null && bTime !== null && aTime !== bTime) {
        return bTime - aTime;
      }
      if (aTime !== null && bTime === null) return -1;
      if (aTime === null && bTime !== null) return 1;
      // Fallback to highest Member ID first when timestamps match or are absent
      return compareMemberIds(bId, aId);
    }

    const idCmp = sortOrder === 'desc' ? compareMemberIds(bId, aId) : compareMemberIds(aId, bId);
    if (idCmp !== 0) return idCmp;

    const aTime = toTimestamp(a.createdAt) ?? 0;
    const bTime = toTimestamp(b.createdAt) ?? 0;
    if (aTime !== bTime) {
      return sortOrder === 'desc' ? bTime - aTime : aTime - bTime;
    }
    return a.id.localeCompare(b.id);
  });
}

/**
 * Generates the next sequential Member ID above the highest existing natural ID
 * so every newly added member lands at the bottom of the default ascending list.
 */
export async function generateUniqueMemberId(
  db: Pick<PrismaClient, 'memberProfile'>,
  maxAttempts = 25
): Promise<string> {
  const existingProfiles = await db.memberProfile.findMany({
    select: { memberId: true },
  });

  if (existingProfiles.length === 0) {
    return '001';
  }

  let highestId = '';
  for (const row of existingProfiles) {
    const candidate = row.memberId?.trim();
    if (!candidate) continue;
    if (!highestId || compareMemberIds(candidate, highestId) > 0) {
      highestId = candidate;
    }
  }

  if (!highestId) {
    return '001';
  }

  const trailingDigitsMatch = highestId.match(/^(.*?)(\d+)$/);
  const prefix = trailingDigitsMatch ? trailingDigitsMatch[1] : `${highestId}-`;
  const digitsPart = trailingDigitsMatch ? trailingDigitsMatch[2] : '';
  const baseNumber = digitsPart ? parseInt(digitsPart, 10) : 0;
  const padWidth = Math.max(3, digitsPart.length);

  for (let step = 1; step <= maxAttempts; step++) {
    const candidate = `${prefix}${String(baseNumber + step).padStart(padWidth, '0')}`;
    const collision = await db.memberProfile.findUnique({
      where: { memberId: candidate },
      select: { id: true },
    });
    if (!collision) {
      return candidate;
    }
  }

  return `${prefix}${Date.now().toString().slice(-6)}`;
}

export interface CreateMemberInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  dob?: Date | null;
  bloodGroup?: string;
  address?: string;
  emergencyContact?: string;
  photoUrl?: string;
}

export async function createMemberRecord(db: PrismaClient, input: CreateMemberInput) {
  const normalizedEmail = input.email.trim().toLowerCase();
  const existingUser = await db.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });
  if (existingUser) {
    throw new BadRequestError('Email already exists', 'EMAIL_EXISTS');
  }

  const [hashedPassword, memberId] = await Promise.all([
    bcrypt.hash(input.password, 10),
    generateUniqueMemberId(db),
  ]);

  const newMember = await db.user.create({
    data: {
      email: normalizedEmail,
      password: hashedPassword,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      role: 'MEMBER',
      memberProfile: {
        create: {
          memberId,
          gender: input.gender,
          dob: input.dob ?? undefined,
          bloodGroup: input.bloodGroup,
          address: input.address,
          emergencyContact: input.emergencyContact,
          photoUrl: input.photoUrl,
        },
      },
    },
    include: {
      memberProfile: true,
    },
    omit: { password: true },
  });

  invalidateCacheScopes('dashboard', 'reports', 'members');
  return newMember;
}

export async function deleteMemberCascade(db: PrismaClient, userId: string) {
  const existing = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      memberProfile: { select: { id: true } },
    },
  });

  if (!existing) {
    throw new NotFoundError('Member not found');
  }

  await db.$transaction(async (tx) => {
    if (existing.memberProfile) {
      const profileId = existing.memberProfile.id;
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
      await tx.memberProfile.delete({ where: { id: profileId } });
    }

    await tx.memberProfile.updateMany({
      where: { trainerId: existing.id },
      data: { trainerId: null },
    });
    await tx.announcement.deleteMany({ where: { authorId: existing.id } });
    await tx.user.delete({ where: { id: existing.id } });
  });

  invalidateCacheScopes('dashboard', 'reports', 'members', `auth:${existing.id}`);
  return existing;
}
