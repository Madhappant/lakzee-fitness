/* eslint-disable @typescript-eslint/no-explicit-any */
import { PrismaClient } from '@prisma/client';
import { AttendanceRepository, attendanceRepository } from '../repositories/attendance.repository';
import { invalidateTenantCacheScopes } from '../utils/cache';
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors';
import { assertBranchOwnership, buildBranchWhere, PRIMARY_BRANCH_ID, type TenantScope } from '../utils/tenant';

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

export class AttendanceService {
  constructor(private readonly repo: AttendanceRepository = attendanceRepository) {}

  async findMemberByIdentifier(sanitizedId: string, branchId?: string | null) {
    const exactMatches = await this.repo.findMembersByExactIdentifier(sanitizedId, branchId);
    if (exactMatches.length > 0) {
      return exactMatches;
    }
    if (sanitizedId.length < 2) {
      return [];
    }
    return this.repo.findMembersByNameFragment(sanitizedId, branchId);
  }

  private async resolveUniqueMember(rawIdentifier: unknown, tenant?: TenantScope) {
    if (!rawIdentifier || typeof rawIdentifier !== 'string' || !rawIdentifier.trim()) {
      throw new BadRequestError('Member ID or QR code is required');
    }

    const sanitized = rawIdentifier.trim();
    const members = await this.findMemberByIdentifier(sanitized, tenant?.branchId);
    if (members.length === 0) {
      // Detect explicit cross-branch QR scan attempts cleanly with HTTP 403
      if (tenant?.branchId && typeof (this.repo as any).findMemberByQrCodeUnscoped === 'function') {
        const crossBranchMatch = await this.repo.findMemberByQrCodeUnscoped(sanitized);
        if (crossBranchMatch) {
          assertBranchOwnership(crossBranchMatch.branchId, tenant);
        }
      }
      throw new NotFoundError('Member not found');
    }
    if (members.length > 1) {
      throw new BadRequestError('Multiple members found. Please use exact ID or scan QR.');
    }
    assertBranchOwnership(members[0].branchId, tenant);
    return members[0];
  }

  async checkIn(rawIdentifier: unknown, now = new Date(), tenant?: TenantScope) {
    const member = await this.resolveUniqueMember(rawIdentifier, tenant);
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const [activeSub, existingCheckIn] = await this.repo.findCheckInPreconditions(member.id, startOfToday);
    if (!activeSub) {
      throw new ForbiddenError('Member does not have an active non-expired subscription');
    }

    const decision = evaluateCheckInWindow(now, existingCheckIn);
    if (decision.action === 'REJECT_ALREADY_CHECKED_IN') {
      throw new BadRequestError('Member is already checked in and has not checked out');
    }

    const autoCloseSession =
      decision.action === 'AUTO_CLOSE'
        ? { attendanceId: decision.attendanceId, autoCheckOutAt: decision.autoCheckOutAt }
        : undefined;

    const effectiveBranchId = member.branchId ?? tenant?.branchId ?? PRIMARY_BRANCH_ID;
    const attendance = await this.repo.recordCheckInTransaction(
      member.id,
      now,
      autoCloseSession,
      effectiveBranchId
    );
    invalidateTenantCacheScopes(effectiveBranchId, 'dashboard', 'reports');

    return {
      memberName: `${member.user.firstName} ${member.user.lastName}`,
      attendance,
    };
  }

  async checkOut(rawIdentifier: unknown, now = new Date(), tenant?: TenantScope) {
    const member = await this.resolveUniqueMember(rawIdentifier, tenant);
    const existingCheckIn = await this.repo.findLatestOpenSessionId(member.id);

    if (!existingCheckIn) {
      throw new BadRequestError('Member is not checked in or already checked out');
    }

    const attendance = await this.repo.completeCheckOut(existingCheckIn.id, now);
    const effectiveBranchId = member.branchId ?? tenant?.branchId ?? PRIMARY_BRANCH_ID;
    invalidateTenantCacheScopes(effectiveBranchId, 'dashboard', 'reports');

    return {
      memberName: `${member.user.firstName} ${member.user.lastName}`,
      attendance,
    };
  }

  listAttendance(startParam?: unknown, endParam?: unknown, branchId?: string | null) {
    let startDate = new Date();
    startDate.setHours(0, 0, 0, 0);

    if (startParam) {
      const parsedStart = new Date(String(startParam));
      if (isNaN(parsedStart.getTime())) {
        throw new BadRequestError('Invalid start date');
      }
      startDate = parsedStart;
    }

    const whereClause: Record<string, any> = {
      checkIn: { gte: startDate },
      ...buildBranchWhere(branchId),
    };

    if (endParam) {
      const parsedEnd = new Date(String(endParam));
      if (isNaN(parsedEnd.getTime())) {
        throw new BadRequestError('Invalid end date');
      }
      whereClause.checkIn.lte = parsedEnd;
    }

    return this.repo.listAttendanceLogs(whereClause);
  }
}

export const attendanceService = new AttendanceService();

export function findMemberByIdentifier(db: PrismaClient, sanitizedId: string) {
  return new AttendanceService(new AttendanceRepository(db)).findMemberByIdentifier(sanitizedId);
}

export function performMemberCheckIn(db: PrismaClient, rawIdentifier: unknown, now = new Date()) {
  return new AttendanceService(new AttendanceRepository(db)).checkIn(rawIdentifier, now);
}

export function performMemberCheckOut(db: PrismaClient, rawIdentifier: unknown, now = new Date()) {
  return new AttendanceService(new AttendanceRepository(db)).checkOut(rawIdentifier, now);
}
