import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { asyncHandler } from '../middlewares/error.middleware';
import { studioService } from '../services/studio.service';
import { sendSuccess } from '../utils/response';
import { resolveWriteBranchId } from '../utils/tenant';

export const getAnnouncements = asyncHandler(async (req: AuthRequest, res: Response) => {
  const branchId = req.tenant?.branchId ?? null;
  const announcements = await studioService.listAnnouncements(branchId);
  return sendSuccess(res, {
    data: announcements,
    meta: { total: announcements.length, branchId: branchId ?? 'all' },
  });
});

export const createAnnouncement = asyncHandler(async (req: AuthRequest, res: Response) => {
  const branchId = resolveWriteBranchId({
    userRole: req.user?.role,
    userBranchId: req.user?.branchId,
    requestedBranchId: req.body.branchId ?? req.tenant?.branchId,
  });
  const announcement = await studioService.createAnnouncement({
    title: req.body.title,
    message: req.body.message,
    authorId: req.user!.id,
    branchId,
  });
  return sendSuccess(res, { statusCode: 201, data: announcement });
});

export const deleteAnnouncement = asyncHandler(async (req: AuthRequest, res: Response) => {
  await studioService.deleteAnnouncement(req.params.id as string, req.tenant);
  return sendSuccess(res, { message: 'Announcement deleted successfully' });
});
