import { Request, Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { asyncHandler } from '../middlewares/error.middleware';
import { billingService } from '../services/billing.service';
import { sendSuccess } from '../utils/response';
import { resolveWriteBranchId } from '../utils/tenant';

export const createPlan = asyncHandler(async (req: AuthRequest, res: Response) => {
  const branchId = resolveWriteBranchId({
    userRole: req.user?.role,
    userBranchId: req.user?.branchId,
    requestedBranchId: req.body.branchId ?? req.tenant?.branchId,
  });
  const plan = await billingService.createPlan({ ...req.body, branchId });
  return sendSuccess(res, { statusCode: 201, data: plan });
});

export const getPlans = asyncHandler(async (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
  const branchParam =
    typeof req.headers['x-branch-id'] === 'string' && req.headers['x-branch-id'].trim()
      ? req.headers['x-branch-id'].trim()
      : typeof req.query.branchId === 'string' && req.query.branchId.trim()
        ? req.query.branchId.trim()
        : null;
  const effectiveBranch = branchParam === 'all' ? null : branchParam;
  const { plans, cached } = await billingService.listActivePlans(effectiveBranch);
  return sendSuccess(res, {
    data: plans,
    meta: { total: plans.length, cached, branchId: effectiveBranch ?? 'all' },
  });
});

export const updatePlan = asyncHandler(async (req: AuthRequest, res: Response) => {
  const plan = await billingService.updatePlan(req.params.id as string, req.body, req.tenant);
  return sendSuccess(res, { data: plan });
});

export const deletePlan = asyncHandler(async (req: AuthRequest, res: Response) => {
  await billingService.deletePlan(req.params.id as string, req.tenant);
  return sendSuccess(res, { message: 'Plan deactivated successfully' });
});
