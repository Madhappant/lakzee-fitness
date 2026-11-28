import { Request, Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { asyncHandler } from '../middlewares/error.middleware';
import { studioService } from '../services/studio.service';
import { sendSuccess } from '../utils/response';
import { resolveWriteBranchId } from '../utils/tenant';

export const getSettings = asyncHandler(async (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
  const authReq = req as AuthRequest;
  const headerBranch =
    typeof req.headers['x-branch-id'] === 'string' && req.headers['x-branch-id'].trim()
      ? req.headers['x-branch-id'].trim()
      : null;
  const queryBranch =
    typeof req.query.branchId === 'string' && req.query.branchId.trim()
      ? req.query.branchId.trim()
      : null;
  const branchId = authReq.tenant?.branchId ?? (headerBranch !== 'all' ? headerBranch : null) ?? (queryBranch !== 'all' ? queryBranch : null);

  const { settings, cached } = await studioService.getSettings(branchId);
  return sendSuccess(res, { data: settings, meta: { cached, branchId: branchId ?? 'all' } });
});

export const updateSettings = asyncHandler(async (req: AuthRequest, res: Response) => {
  const branchId = resolveWriteBranchId({
    userRole: req.user?.role,
    userBranchId: req.user?.branchId,
    requestedBranchId: req.body.branchId ?? req.tenant?.branchId,
  });
  const updated = await studioService.updateSettings(req.body, branchId);
  return sendSuccess(res, { data: updated, meta: { branchId } });
});
