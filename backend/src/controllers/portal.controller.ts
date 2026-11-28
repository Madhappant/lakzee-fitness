import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { asyncHandler } from '../middlewares/error.middleware';
import { portalRoutineService } from '../services/portal-routine.service';
import { BadRequestError } from '../utils/errors';
import { sendSuccess } from '../utils/response';

export const getMyProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
  const memberProfile = await portalRoutineService.getMyProfile(req.user?.id);
  return sendSuccess(res, { data: memberProfile });
});

export const getMyAttendance = asyncHandler(async (req: AuthRequest, res: Response) => {
  const attendance = await portalRoutineService.getMyAttendance(req.user?.id);
  return sendSuccess(res, { data: attendance, meta: { total: attendance.length } });
});

export const getMySubscriptions = asyncHandler(async (req: AuthRequest, res: Response) => {
  const subscriptions = await portalRoutineService.getMySubscriptions(req.user?.id);
  return sendSuccess(res, { data: subscriptions, meta: { total: subscriptions.length } });
});

export const uploadPhoto = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.file) throw new BadRequestError('No file uploaded');
  const updatedProfile = await portalRoutineService.updateMyPhoto(req.user?.id, req.file);
  return sendSuccess(res, { data: { photoUrl: updatedProfile.photoUrl } });
});

export const getMyDietPlan = asyncHandler(async (req: AuthRequest, res: Response) => {
  const activeDietPlan = await portalRoutineService.getMyDietPlan(req.user?.id);
  return sendSuccess(res, { data: activeDietPlan });
});

export const getMyWorkoutRoutine = asyncHandler(async (req: AuthRequest, res: Response) => {
  const activeRoutine = await portalRoutineService.getMyWorkoutRoutine(req.user?.id);
  return sendSuccess(res, { data: activeRoutine });
});
