/* eslint-disable @typescript-eslint/no-explicit-any */
import { PrismaClient } from '@prisma/client';
import { prisma } from '../config/prisma';
import { buildBranchWhere, PRIMARY_BRANCH_ID } from '../utils/tenant';

interface MemoryRefreshSessionRecord {
  id: string;
  familyId: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedById: string | null;
  userAgent?: string;
  ipAddress?: string;
}

const memorySessionsByHash = new Map<string, MemoryRefreshSessionRecord>();

function isMissingRefreshTable(err: unknown, db: any): boolean {
  if (!db?.refreshSession) return true;
  const e = err as { code?: string; message?: string };
  return e?.code === 'P2021' || Boolean(e?.message?.includes('RefreshSession'));
}

export class AuthStaffRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  findUserByEmail(email: string) {
    return this.db.user.findUnique({ where: { email }, select: { id: true, branchId: true } });
  }

  findUserForLogin(email: string) {
    return this.db.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        password: true,
        role: true,
        branchId: true,
        firstName: true,
        lastName: true,
      },
    });
  }

  findUserForSession(userId: string) {
    return this.db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        branchId: true,
        firstName: true,
        lastName: true,
      },
    });
  }

  createRegisteredUser(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    branchId?: string;
  }) {
    return this.db.user.create({
      data: {
        ...data,
        branchId: data.branchId ?? PRIMARY_BRANCH_ID,
      },
      select: {
        id: true,
        email: true,
        role: true,
        branchId: true,
        firstName: true,
        lastName: true,
      },
    });
  }

  async createRefreshSession(input: {
    id: string;
    familyId: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    userAgent?: string;
    ipAddress?: string;
  }) {
    try {
      return await this.db.refreshSession.create({ data: input });
    } catch (err) {
      if (!isMissingRefreshTable(err, this.db)) throw err;
      const record: MemoryRefreshSessionRecord = {
        ...input,
        revokedAt: null,
        replacedById: null,
      };
      memorySessionsByHash.set(input.tokenHash, record);
      return record;
    }
  }

  async findRefreshSessionByHash(tokenHash: string) {
    try {
      return await this.db.refreshSession.findUnique({ where: { tokenHash } });
    } catch (err) {
      if (!isMissingRefreshTable(err, this.db)) throw err;
      return memorySessionsByHash.get(tokenHash) ?? null;
    }
  }

  async rotateRefreshSession(
    oldSessionId: string,
    newSession: {
      id: string;
      familyId: string;
      userId: string;
      tokenHash: string;
      expiresAt: Date;
      userAgent?: string;
      ipAddress?: string;
    }
  ) {
    const now = new Date();
    try {
      return await this.db.$transaction(async (tx) => {
        await tx.refreshSession.update({
          where: { id: oldSessionId },
          data: { revokedAt: now, replacedById: newSession.id },
        });
        return tx.refreshSession.create({ data: newSession });
      });
    } catch (err) {
      if (!isMissingRefreshTable(err, this.db)) throw err;
      for (const session of memorySessionsByHash.values()) {
        if (session.id === oldSessionId) {
          session.revokedAt = now;
          session.replacedById = newSession.id;
        }
      }
      const created: MemoryRefreshSessionRecord = {
        ...newSession,
        revokedAt: null,
        replacedById: null,
      };
      memorySessionsByHash.set(newSession.tokenHash, created);
      return created;
    }
  }

  async revokeRefreshFamily(familyId: string) {
    const now = new Date();
    try {
      return await this.db.refreshSession.updateMany({
        where: { familyId, revokedAt: null },
        data: { revokedAt: now },
      });
    } catch (err) {
      if (!isMissingRefreshTable(err, this.db)) throw err;
      for (const session of memorySessionsByHash.values()) {
        if (session.familyId === familyId && !session.revokedAt) {
          session.revokedAt = now;
        }
      }
      return { count: 0 };
    }
  }

  async revokeRefreshSessionByHash(tokenHash: string) {
    const now = new Date();
    try {
      return await this.db.refreshSession.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: now },
      });
    } catch (err) {
      if (!isMissingRefreshTable(err, this.db)) throw err;
      const existing = memorySessionsByHash.get(tokenHash);
      if (existing && !existing.revokedAt) {
        existing.revokedAt = now;
      }
      return { count: 0 };
    }
  }

  setResetOtp(email: string, otp: string, expiry: Date) {
    return this.db.user.update({
      where: { email },
      data: { resetOtp: otp, resetOtpExpiry: expiry },
      select: { id: true },
    });
  }

  findUserForReset(email: string) {
    return this.db.user.findUnique({
      where: { email },
      select: { id: true, resetOtp: true, resetOtpExpiry: true },
    });
  }

  completePasswordReset(email: string, hashedPassword: string) {
    return this.db.user.update({
      where: { email },
      data: { password: hashedPassword, resetOtp: null, resetOtpExpiry: null },
      select: { id: true },
    });
  }

  findUserEmailById(userId: string) {
    return this.db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });
  }

  setPhoneVerificationOtp(userId: string, pendingPhone: string, otp: string, expiry: Date) {
    return this.db.user.update({
      where: { id: userId },
      data: { pendingPhone, phoneOtp: otp, phoneOtpExpiry: expiry },
      select: { id: true },
    });
  }

  findUserForPhoneVerification(userId: string) {
    return this.db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phoneOtp: true,
        phoneOtpExpiry: true,
        pendingPhone: true,
      },
    });
  }

  completePhoneVerification(userId: string, verifiedPhone: string) {
    return this.db.user.update({
      where: { id: userId },
      data: {
        phone: verifiedPhone,
        pendingPhone: null,
        phoneOtp: null,
        phoneOtpExpiry: null,
      },
      select: {
        id: true,
        email: true,
        role: true,
        branchId: true,
        firstName: true,
        lastName: true,
        phone: true,
      },
    });
  }

  listStaffUsers(branchId?: string | null) {
    return this.db.user.findMany({
      where: {
        role: { in: ['SUPER_ADMIN', 'BRANCH_ADMIN', 'ADMIN', 'RECEPTIONIST', 'TRAINER', 'STAFF'] },
        ...buildBranchWhere(branchId),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        branchId: true,
        createdAt: true,
        updatedAt: true,
        roleAssignedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  findUserIdByLakzeeMemberId(memberId: string, branchId?: string | null) {
    return this.db.memberProfile.findFirst({
      where: { memberId, ...buildBranchWhere(branchId) },
      select: { userId: true, branchId: true },
    });
  }

  findUserById(userId: string) {
    return this.db.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, branchId: true },
    });
  }

  updateUserRole(userId: string, role: string, roleAssignedAt?: Date, branchId?: string) {
    return this.db.user.update({
      where: { id: userId },
      data: {
        role,
        ...(roleAssignedAt ? { roleAssignedAt } : {}),
        ...(branchId ? { branchId } : {}),
      },
      omit: {
        password: true,
        resetOtp: true,
        resetOtpExpiry: true,
        phoneOtp: true,
        phoneOtpExpiry: true,
      },
    });
  }
}

export const authStaffRepository = new AuthStaffRepository();
