import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { asyncHandler } from '../middlewares/error.middleware';
import { billingService } from '../services/billing.service';
import { sendSuccess } from '../utils/response';
import { resolveWriteBranchId } from '../utils/tenant';

export const createSubscription = asyncHandler(async (req: AuthRequest, res: Response) => {
  const branchId = resolveWriteBranchId({
    userRole: req.user?.role,
    userBranchId: req.user?.branchId,
    requestedBranchId: req.body.branchId ?? req.tenant?.branchId,
  });
  const subscription = await billingService.createSubscription(
    { ...req.body, branchId },
    req.tenant
  );
  return sendSuccess(res, { statusCode: 201, data: subscription });
});

export const getSubscriptions = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { search, status, paymentStatus } = req.validated?.query ?? req.query;
  const subscriptions = await billingService.listSubscriptions(
    { search, status, paymentStatus },
    req.tenant?.branchId
  );
  return sendSuccess(res, {
    data: subscriptions,
    meta: { total: subscriptions.length, branchId: req.tenant?.branchId ?? 'all' },
  });
});

export const getPaymentStats = asyncHandler(async (req: AuthRequest, res: Response) => {
  const stats = await billingService.getPaymentStats(req.tenant?.branchId);
  return sendSuccess(res, { data: stats, meta: { branchId: req.tenant?.branchId ?? 'all' } });
});

export const updateSubscription = asyncHandler(async (req: AuthRequest, res: Response) => {
  const updated = await billingService.updateSubscription(
    req.params.id as string,
    req.body,
    req.tenant
  );
  return sendSuccess(res, { data: updated });
});

export const deleteSubscription = asyncHandler(async (req: AuthRequest, res: Response) => {
  await billingService.deleteSubscription(req.params.id as string, req.tenant);
  return sendSuccess(res, { message: 'Subscription deleted successfully' });
});
