import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { asyncHandler } from '../middlewares/error.middleware';
import { analyticsService } from '../services/analytics.service';
import { sendSuccess } from '../utils/response';

export const getDashboardStats = asyncHandler(async (req: AuthRequest, res: Response) => {
  const branchId = req.tenant?.branchId ?? null;
  const { data, cached } = await analyticsService.getDashboardStats(branchId);
  return sendSuccess(res, {
    data,
    meta: { cached, branchId: branchId ?? 'all' },
  });
});
