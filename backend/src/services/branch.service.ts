import { BranchRepository, branchRepository } from '../repositories/branch.repository';
import { CACHE_KEYS, invalidateCacheScopes, memoryCache } from '../utils/cache';
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors';
import {
  PRIMARY_BRANCH_CODE,
  PRIMARY_BRANCH_ID,
  PRIMARY_BRANCH_LOCATION,
  PRIMARY_BRANCH_NAME,
} from '../utils/tenant';

export class BranchService {
  constructor(private readonly repo: BranchRepository = branchRepository) {}

  async listBranchesForUser(requester?: { role?: string; branchId?: string | null }) {
    const cacheKey = `${CACHE_KEYS.BRANCHES_LIST}:all`;
    let branches = await memoryCache.getDistributed<Awaited<ReturnType<BranchRepository['listBranches']>>>(cacheKey, 120);

    if (!branches) {
      branches = await this.repo.listBranches();
      if (branches.length === 0) {
        branches = [
          {
            id: PRIMARY_BRANCH_ID,
            name: PRIMARY_BRANCH_NAME,
            code: PRIMARY_BRANCH_CODE,
            location: PRIMARY_BRANCH_LOCATION,
            status: 'ACTIVE',
            createdAt: new Date(0),
            updatedAt: new Date(0),
          },
        ];
      }
      memoryCache.set(cacheKey, branches, 120);
    }

    if (requester?.role === 'SUPER_ADMIN') {
      return branches;
    }

    const scopedBranchId = requester?.branchId || PRIMARY_BRANCH_ID;
    return branches.filter((b) => b.id === scopedBranchId);
  }

  async getBranchById(
    id: string,
    requester?: { role?: string; branchId?: string | null }
  ) {
    if (requester?.role !== 'SUPER_ADMIN' && id !== (requester?.branchId || PRIMARY_BRANCH_ID)) {
      throw new ForbiddenError('Forbidden: Cross-branch access is denied');
    }
    const branch = await this.repo.findBranchById(id);
    if (!branch) {
      throw new NotFoundError('Branch not found');
    }
    return branch;
  }

  async createBranch(input: { name: string; code?: string; location: string; status?: 'ACTIVE' | 'INACTIVE' }) {
    const normalizedName = input.name.trim();
    const existingAll = await this.repo.listBranches();
    const nextCodeNumber = existingAll.length + 1;
    const normalizedCode = (input.code?.trim() || `BR-${String(nextCodeNumber).padStart(3, '0')}`).toUpperCase();

    const collision = await this.repo.findBranchByCodeOrName(normalizedCode, normalizedName);
    if (collision) {
      throw new BadRequestError('Branch with that name or code already exists');
    }

    const created = await this.repo.createBranch({
      name: normalizedName,
      code: normalizedCode,
      location: input.location.trim(),
      status: input.status ?? 'ACTIVE',
    });

    invalidateCacheScopes('branches', 'dashboard');
    return created;
  }

  async updateBranch(
    id: string,
    input: Partial<{ name: string; code: string; location: string; status: 'ACTIVE' | 'INACTIVE' }>
  ) {
    const existing = await this.repo.findBranchById(id);
    if (!existing) {
      throw new NotFoundError('Branch not found');
    }

    const updateData: Partial<{ name: string; code: string; location: string; status: string }> = {};
    if (input.name !== undefined) updateData.name = input.name.trim();
    if (input.code !== undefined) updateData.code = input.code.trim().toUpperCase();
    if (input.location !== undefined) updateData.location = input.location.trim();
    if (input.status !== undefined) updateData.status = input.status;

    const updated = await this.repo.updateBranch(id, updateData);
    invalidateCacheScopes('branches', 'dashboard');
    return updated;
  }
}

export const branchService = new BranchService();
