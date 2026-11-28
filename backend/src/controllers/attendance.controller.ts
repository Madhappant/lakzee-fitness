import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { asyncHandler } from '../middlewares/error.middleware';
import { attendanceService } from '../services/attendance.service';
import { sendSuccess } from '../utils/response';

export const checkIn = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await attendanceService.checkIn(req.body.lakzeeId, new Date(), req.tenant);
  return sendSuccess(res, {
    statusCode: 201,
    message: `Checked in ${result.memberName}`,
    data: result.attendance,
  });
});

export const getTodayAttendance = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { start, end } = req.validated?.query ?? req.query;
  const logs = await attendanceService.listAttendance(start, end, req.tenant?.branchId);
  return sendSuccess(res, {
    data: logs,
    meta: { total: logs.length, branchId: req.tenant?.branchId ?? 'all' },
  });
});

export const checkOut = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await attendanceService.checkOut(req.body.lakzeeId, new Date(), req.tenant);
  return sendSuccess(res, {
    message: `Checked out ${result.memberName}`,
    data: result.attendance,
  });
});
