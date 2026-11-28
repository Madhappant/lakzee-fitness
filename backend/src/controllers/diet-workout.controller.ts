import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { asyncHandler } from '../middlewares/error.middleware';
import { portalRoutineService } from '../services/portal-routine.service';
import { sendSuccess } from '../utils/response';

export const assignDietPlan = asyncHandler(async (req: AuthRequest, res: Response) => {
  const newDietPlan = await portalRoutineService.assignDietPlan(
    req.params.memberId as string,
    req.body,
    req.user?.id,
    req.tenant
  );
  return sendSuccess(res, { statusCode: 201, data: newDietPlan });
});

export const getMemberDietPlan = asyncHandler(async (req: AuthRequest, res: Response) => {
  const activeDietPlan = await portalRoutineService.getDietPlanForMember(
    req.params.memberId as string,
    req.user,
    req.tenant
  );
  return sendSuccess(res, { data: activeDietPlan });
});

export const assignWorkoutRoutine = asyncHandler(async (req: AuthRequest, res: Response) => {
  const newRoutine = await portalRoutineService.assignWorkoutRoutine(
    req.params.memberId as string,
    req.body,
    req.user?.id,
    req.tenant
  );
  return sendSuccess(res, { statusCode: 201, data: newRoutine });
});

export const getMemberWorkoutRoutine = asyncHandler(async (req: AuthRequest, res: Response) => {
  const activeRoutine = await portalRoutineService.getWorkoutRoutineForMember(
    req.params.memberId as string,
    req.user,
    req.tenant
  );
  return sendSuccess(res, { data: activeRoutine });
});
