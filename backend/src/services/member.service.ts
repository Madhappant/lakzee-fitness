import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { securityEnv } from '../config/env';
import { MemberRepository, memberRepository } from '../repositories/member.repository';
import { CACHE_KEYS, invalidateTenantCacheScopes, memoryCache } from '../utils/cache';
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors';
import {
  assertBranchOwnership,
  PRIMARY_BRANCH_ID,
  scopedCacheKey,
  type TenantScope,
} from '../utils/tenant';
import { isValidE164Phone, normalizeE164Phone } from './notifications/e164';

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
 * Generates the next sequential Member ID within the target branch
 * so every newly added member lands at the bottom of that branch's default list.
 */
export function generateUniqueMemberId(
  db?: Pick<PrismaClient, 'memberProfile'>,
  maxAttempts = 25,
  branchId?: string | null
): Promise<string> {
  const service = db ? new MemberService(new MemberRepository(db as PrismaClient)) : memberService;
  return service.generateSequentialMemberId(maxAttempts, branchId);
}

export interface CreateMemberInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  branchId?: string;
  phone?: string;
  whatsappNumber?: string;
  notificationsEnabled?: boolean;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  dob?: Date | null;
  bloodGroup?: string;
  address?: string;
  emergencyContact?: string;
  photoUrl?: string;
}

export interface UpdateMemberInput {
  memberId?: string;
  branchId?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  whatsappNumber?: string | null;
  notificationsEnabled?: boolean;
  email?: string;
  password?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  dob?: Date | null;
  bloodGroup?: string;
  address?: string;
  emergencyContact?: string;
  photoUrl?: string;
}

export interface ListMembersOptions {
  branchId?: string | null;
  cursor?: string;
  limit?: number;
}

export class MemberService {
  constructor(private readonly repo: MemberRepository = memberRepository) {}

  async generateSequentialMemberId(maxAttempts = 25, branchId?: string | null): Promise<string> {
    const existingProfiles = await this.repo.findAllMemberIds(branchId);
    if (existingProfiles.length === 0) return '001';

    let highestId = '';
    for (const row of existingProfiles) {
      const candidate = row.memberId?.trim();
      if (!candidate) continue;
      if (!highestId || compareMemberIds(candidate, highestId) > 0) {
        highestId = candidate;
      }
    }

    if (!highestId) return '001';

    const trailingDigitsMatch = highestId.match(/^(.*?)(\d+)$/);
    const prefix = trailingDigitsMatch ? trailingDigitsMatch[1] : `${highestId}-`;
    const digitsPart = trailingDigitsMatch ? trailingDigitsMatch[2] : '';
    const baseNumber = digitsPart ? parseInt(digitsPart, 10) : 0;
    const padWidth = Math.max(3, digitsPart.length);

    for (let step = 1; step <= maxAttempts; step++) {
      const candidate = `${prefix}${String(baseNumber + step).padStart(padWidth, '0')}`;
      const collision = await this.repo.findProfileByMemberId(candidate, branchId);
      if (!collision) {
        return candidate;
      }
    }

    return `${prefix}${Date.now().toString().slice(-6)}`;
  }

  async createMember(input: CreateMemberInput) {
    const resolvedBranchId = input.branchId?.trim() || PRIMARY_BRANCH_ID;
    const normalizedEmail = input.email.trim().toLowerCase();
    const existingUser = await this.repo.findUserByEmail(normalizedEmail);
    if (existingUser) {
      throw new BadRequestError('Email already exists', 'EMAIL_EXISTS');
    }

    const [hashedPassword, memberId] = await Promise.all([
      bcrypt.hash(input.password, securityEnv.bcryptCostFactor),
      this.generateSequentialMemberId(25, resolvedBranchId),
    ]);

    let normalizedWhatsapp: string | undefined;
    if (input.whatsappNumber !== undefined && input.whatsappNumber !== null && String(input.whatsappNumber).trim() !== '') {
      if (!isValidE164Phone(input.whatsappNumber)) {
        throw new BadRequestError('WhatsApp number must be in E.164 format (e.g., +919876543210)');
      }
      normalizedWhatsapp = normalizeE164Phone(input.whatsappNumber) ?? undefined;
    }

    const newMember = await this.repo.createMemberWithProfile({
      email: normalizedEmail,
      password: hashedPassword,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      branchId: resolvedBranchId,
      memberId,
      whatsappNumber: normalizedWhatsapp,
      notificationsEnabled: input.notificationsEnabled ?? true,
      gender: input.gender,
      dob: input.dob ?? undefined,
      bloodGroup: input.bloodGroup,
      address: input.address,
      emergencyContact: input.emergencyContact,
      photoUrl: input.photoUrl,
    });

    invalidateTenantCacheScopes(resolvedBranchId, 'dashboard', 'reports', 'members');
    return newMember;
  }

  async listMembers(sortOrderRaw?: unknown, options: ListMembersOptions = {}) {
    const sortOrder = parseMemberSortOrder(sortOrderRaw);
    const branchId = options.branchId ?? null;
    const limit = options.limit;
    const cursor = options.cursor;
    const baseKey = scopedCacheKey(CACHE_KEYS.MEMBERS_LIST, branchId);
    const cacheKey = limit !== undefined
      ? `${baseKey}:${sortOrder}:l${limit}:c${cursor || 'start'}`
      : `${baseKey}:${sortOrder}`;

    if (limit !== undefined) {
      const cachedPage = await memoryCache.getDistributed<{
        members: any[];
        total: number;
        nextCursor: string | null;
        hasMore: boolean;
      }>(cacheKey, 30);
      if (cachedPage) {
        return {
          members: cachedPage.members,
          total: cachedPage.total,
          nextCursor: cachedPage.nextCursor,
          hasMore: cachedPage.hasMore,
          sortOrder,
          cached: true,
        };
      }
    } else {
      const cached = await memoryCache.getDistributed<any[]>(cacheKey, 30);
      if (cached) {
        return {
          members: cached,
          total: cached.length,
          nextCursor: null,
          hasMore: false,
          sortOrder,
          cached: true,
        };
      }
    }

    const orderBy =
      sortOrder === 'latest'
        ? [{ createdAt: 'desc' as const }, { id: 'desc' as const }]
        : [{ memberProfile: { memberId: sortOrder === 'desc' ? ('desc' as const) : ('asc' as const) } }, { id: 'asc' as const }];

    const rawMembers = await this.repo.listMembers(orderBy, { branchId, cursor, limit });

    if (limit !== undefined) {
      const hasMore = rawMembers.length > limit;
      const pageSlice = hasMore ? rawMembers.slice(0, limit) : rawMembers;
      const sortedSlice = sortMembers(pageSlice, sortOrder);
      const nextCursor = hasMore && pageSlice.length > 0 ? pageSlice[pageSlice.length - 1].id : null;
      const total =
        typeof (this.repo as any).countMembers === 'function'
          ? await this.repo.countMembers(branchId)
          : sortedSlice.length;

      memoryCache.set(cacheKey, { members: sortedSlice, total, nextCursor, hasMore }, 30);
      return {
        members: sortedSlice,
        total,
        nextCursor,
        hasMore,
        sortOrder,
        cached: false,
      };
    }

    const sortedMembers = sortMembers(rawMembers, sortOrder);
    memoryCache.set(cacheKey, sortedMembers, 30);

    return {
      members: sortedMembers,
      total: sortedMembers.length,
      nextCursor: null,
      hasMore: false,
      sortOrder,
      cached: false,
    };
  }

  async getMemberById(
    id: string,
    requester?: { id: string; role: string; branchId?: string | null },
    tenant?: TenantScope
  ) {
    if (requester?.role === 'MEMBER' && requester.id !== id) {
      throw new ForbiddenError('Forbidden: You can only view your own profile');
    }

    const member = await this.repo.findMemberDetailById(id);
    if (!member) {
      throw new NotFoundError('Member not found');
    }

    assertBranchOwnership(member.branchId ?? member.memberProfile?.branchId, tenant ?? requester);
    return member;
  }

  async updateMember(id: string, input: UpdateMemberInput, tenant?: TenantScope) {
    const existingUser = await this.repo.findMemberSummaryById(id);
    if (!existingUser) {
      throw new NotFoundError('Member not found');
    }

    const memberBranchId = existingUser.branchId ?? existingUser.memberProfile?.branchId ?? PRIMARY_BRANCH_ID;
    assertBranchOwnership(memberBranchId, tenant);

    const { firstName, lastName, phone, whatsappNumber, notificationsEnabled, email, password, memberId, dob, photoUrl, branchId, ...profileData } = input;
    const effectiveBranchId = tenant?.isGlobalView && branchId ? branchId : memberBranchId;

    const [existingEmail, existingProfile] = await Promise.all([
      email ? this.repo.findUserByEmail(email) : Promise.resolve(null),
      memberId ? this.repo.findProfileByMemberId(memberId.trim(), effectiveBranchId) : Promise.resolve(null),
    ]);

    if (existingEmail && existingEmail.id !== id) {
      throw new BadRequestError('Email already exists');
    }
    if (existingProfile && existingProfile.userId !== id) {
      throw new BadRequestError('Member No. already exists in this branch. Please choose a unique Member No.');
    }

    const profileUpdateFields: Record<string, unknown> = {
      ...profileData,
      ...(memberId ? { memberId: memberId.trim() } : {}),
    };
    if (whatsappNumber !== undefined) {
      if (whatsappNumber === null || whatsappNumber === '') {
        profileUpdateFields.whatsappNumber = null;
      } else {
        if (!isValidE164Phone(whatsappNumber)) {
          throw new BadRequestError('WhatsApp number must be in E.164 format (e.g., +919876543210)');
        }
        profileUpdateFields.whatsappNumber = normalizeE164Phone(whatsappNumber);
      }
    }
    if (notificationsEnabled !== undefined) {
      profileUpdateFields.notificationsEnabled = notificationsEnabled;
    }
    if (dob !== undefined) profileUpdateFields.dob = dob;
    if (photoUrl) profileUpdateFields.photoUrl = photoUrl;

    const updateData: Record<string, unknown> = {
      firstName,
      lastName,
      phone,
    };

    if (existingUser.memberProfile) {
      updateData.memberProfile = { update: profileUpdateFields };
    } else if (memberId || Object.keys(profileUpdateFields).length > 0) {
      updateData.memberProfile = {
        create: {
          branchId: effectiveBranchId,
          memberId: memberId ? memberId.trim() : await this.generateSequentialMemberId(25, effectiveBranchId),
          ...profileUpdateFields,
        },
      };
    }

    if (email) updateData.email = email;
    if (password) updateData.password = await bcrypt.hash(password, securityEnv.bcryptCostFactor);

    const updatedMember = await this.repo.updateMemberUser(id, updateData);
    invalidateTenantCacheScopes(effectiveBranchId, 'dashboard', 'reports', 'members', `auth:${id}`);
    return updatedMember;
  }

  async deleteMember(userId: string, tenant?: TenantScope) {
    const existing = await this.repo.findMemberSummaryById(userId);
    if (!existing) {
      throw new NotFoundError('Member not found');
    }

    const memberBranchId = existing.branchId ?? existing.memberProfile?.branchId ?? PRIMARY_BRANCH_ID;
    assertBranchOwnership(memberBranchId, tenant);

    await this.repo.deleteMemberCascade(existing.id, existing.memberProfile?.id);
    invalidateTenantCacheScopes(memberBranchId, 'dashboard', 'reports', 'members', `auth:${existing.id}`);
    return { ...existing, branchId: memberBranchId };
  }
}

export const memberService = new MemberService();

export function createMemberRecord(db: PrismaClient | undefined, input: CreateMemberInput) {
  const service = db ? new MemberService(new MemberRepository(db)) : memberService;
  return service.createMember(input);
}

export function deleteMemberCascade(db: PrismaClient | undefined, userId: string) {
  const service = db ? new MemberService(new MemberRepository(db)) : memberService;
  return service.deleteMember(userId);
}
