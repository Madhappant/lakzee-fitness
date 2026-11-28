import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { asyncHandler } from '../middlewares/error.middleware';
import { analyticsService } from '../services/analytics.service';
import { sendSuccess } from '../utils/response';

export const getReports = asyncHandler(async (req: AuthRequest, res: Response) => {
  const branchId = req.tenant?.branchId ?? null;
  const { data, cached } = await analyticsService.getReportsOverview(branchId);
  return sendSuccess(res, {
    data,
    meta: { cached, branchId: branchId ?? 'all' },
  });
});
