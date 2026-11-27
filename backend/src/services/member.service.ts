import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { invalidateCacheScopes } from '../utils/cache';
import { BadRequestError, NotFoundError } from '../utils/errors';

export async function generateUniqueMemberId(
  db: Pick<PrismaClient, 'memberProfile'>,
  maxAttempts = 20
): Promise<string> {
  for (let attempts = 0; attempts < maxAttempts; attempts++) {
    const candidate = `LZ-${Math.floor(1000 + Math.random() * 9000)}`;
    const existing = await db.memberProfile.findUnique({
      where: { memberId: candidate },
      select: { id: true },
    });
    if (!existing) {
      return candidate;
    }
  }
  return `LZ-${Date.now().toString().slice(-6)}`;
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
