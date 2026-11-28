import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { asyncHandler } from '../middlewares/error.middleware';
import { auditService } from '../services/audit.service';
import { branchService } from '../services/branch.service';
import { sendSuccess } from '../utils/response';

export const getBranches = asyncHandler(async (req: AuthRequest, res: Response) => {
  const branches = await branchService.listBranchesForUser(req.user);
  return sendSuccess(res, {
    data: branches,
    meta: { total: branches.length },
  });
});

export const getBranchById = asyncHandler(async (req: AuthRequest, res: Response) => {
  const branch = await branchService.getBranchById(req.params.id as string, req.user);
  return sendSuccess(res, { data: branch });
});

export const createBranch = asyncHandler(async (req: AuthRequest, res: Response) => {
  const branch = await branchService.createBranch(req.body);

  auditService.record({
    branchId: branch.id,
    actorId: req.user?.id,
    actorRole: req.user?.role,
    action: 'BRANCH_CREATED',
    targetId: branch.id,
    ipAddress: req.ip,
    description: `Provisioned branch ${branch.code} (${branch.name})`,
    metadata: { code: branch.code, location: branch.location },
  });

  return sendSuccess(res, { statusCode: 201, data: branch });
});

export const updateBranch = asyncHandler(async (req: AuthRequest, res: Response) => {
  const branchId = req.params.id as string;
  const branch = await branchService.updateBranch(branchId, req.body);

  auditService.record({
    branchId: branch.id,
    actorId: req.user?.id,
    actorRole: req.user?.role,
    action: 'BRANCH_UPDATED',
    targetId: branch.id,
    ipAddress: req.ip,
    description: `Updated branch ${branch.code} (${branch.status})`,
    metadata: { status: branch.status, location: branch.location },
  });

  return sendSuccess(res, { data: branch });
});
