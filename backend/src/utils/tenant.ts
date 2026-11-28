import { ForbiddenError } from './errors';

export const PRIMARY_BRANCH_ID = 'branch-primary-001';
export const PRIMARY_BRANCH_CODE = 'BR-001';
export const PRIMARY_BRANCH_NAME = 'Lakzee Primary Studio';
export const PRIMARY_BRANCH_LOCATION = 'Main Studio Campus';

export interface TenantScope {
  /** Null represents global multi-branch aggregation (exclusive to SUPER_ADMIN in 'all' mode). */
  branchId: string | null;
  isGlobalView: boolean;
  actorRole: string;
}

/**
 * Resolves the effective branch scope for any request, strictly blocking non-SUPER_ADMIN
 * callers with HTTP 403 whenever they attempt to switch into or query a different branch.
 */
export function resolveTenantScope(params: {
  userRole: string;
  userBranchId?: string | null;
  requestedBranchId?: unknown;
}): TenantScope {
  const normalizedUserBranch = normalizeOptionalBranchId(params.userBranchId) ?? PRIMARY_BRANCH_ID;
  const requested = normalizeOptionalBranchId(params.requestedBranchId);

  if (params.userRole === 'SUPER_ADMIN') {
    if (!requested || requested === 'all') {
      return {
        branchId: null,
        isGlobalView: true,
        actorRole: params.userRole,
      };
    }
    return {
      branchId: requested,
      isGlobalView: false,
      actorRole: params.userRole,
    };
  }

  if (requested && (requested === 'all' || requested !== normalizedUserBranch)) {
    throw new ForbiddenError('Forbidden: Cross-branch access is denied');
  }

  return {
    branchId: normalizedUserBranch,
    isGlobalView: false,
    actorRole: params.userRole,
  };
}

/**
 * Ensures a write operation targets the actor's locked branch (or the selected branch for SUPER_ADMIN).
 */
export function resolveWriteBranchId(params: {
  userRole?: string;
  userBranchId?: string | null;
  requestedBranchId?: unknown;
  fallbackBranchId?: string | null;
}): string {
  const userBranch = normalizeOptionalBranchId(params.userBranchId) ?? PRIMARY_BRANCH_ID;
  const requested = normalizeOptionalBranchId(params.requestedBranchId);

  if (params.userRole === 'SUPER_ADMIN') {
    if (requested && requested !== 'all') {
      return requested;
    }
    return normalizeOptionalBranchId(params.fallbackBranchId) ?? userBranch;
  }

  if (requested && (requested === 'all' || requested !== userBranch)) {
    throw new ForbiddenError('Forbidden: Cannot mutate resources outside your assigned branch');
  }

  return userBranch;
}

/**
 * Verifies resource-level tenant isolation on single-record lookups and mutations.
 * Legacy unmigrated rows without branchId default to PRIMARY_BRANCH_ID safely.
 */
export function assertBranchOwnership(
  resourceBranchId: string | null | undefined,
  scope?: { branchId?: string | null; isGlobalView?: boolean; role?: string; userBranchId?: string | null }
): void {
  if (!scope) return;
  if (scope.role === 'SUPER_ADMIN' && (scope.isGlobalView || !scope.branchId)) {
    return;
  }

  const actorBranchId = scope.branchId ?? normalizeOptionalBranchId(scope.userBranchId);
  if (!actorBranchId) return;

  const targetBranchId = normalizeOptionalBranchId(resourceBranchId) ?? PRIMARY_BRANCH_ID;
  if (targetBranchId !== actorBranchId) {
    throw new ForbiddenError('Forbidden: Resource belongs to a different branch');
  }
}

export function normalizeOptionalBranchId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Builds a Prisma `where` fragment scoped by branchId while preserving pre-migration
 * null rows under the primary branch so zero historical records disappear during upgrades.
 */
export function buildBranchWhere(branchId?: string | null): Record<string, unknown> {
  if (!branchId) return {};
  if (branchId === PRIMARY_BRANCH_ID) {
    return {
      OR: [{ branchId: PRIMARY_BRANCH_ID }, { branchId: null }],
    };
  }
  return { branchId };
}

export function scopedCacheKey(baseKey: string, branchId?: string | null): string {
  return `${baseKey}:${branchId ?? 'all'}`;
}
