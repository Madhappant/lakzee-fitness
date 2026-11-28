import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { asyncHandler } from '../middlewares/error.middleware';
import { auditService } from '../services/audit.service';
import { studioService } from '../services/studio.service';
import { sendSuccess } from '../utils/response';

export const getStaff = asyncHandler(async (req: AuthRequest, res: Response) => {
  const branchId = req.tenant?.branchId ?? null;
  const users = await studioService.listStaff(branchId);
  return sendSuccess(res, {
    data: users,
    meta: { total: users.length, branchId: branchId ?? 'all' },
  });
});

export const assignRole = asyncHandler(async (req: AuthRequest, res: Response) => {
  const updated = await studioService.assignStaffRole(req.body, req.user?.role, req.tenant);

  auditService.record({
    branchId: updated.branchId ?? req.tenant?.branchId,
    actorId: req.user?.id,
    actorRole: req.user?.role,
    action: 'ROLE_CHANGED',
    targetId: updated.id,
    ipAddress: req.ip,
    description: `Assigned role ${updated.role} to user ${updated.id}`,
    metadata: { newRole: updated.role, branchId: updated.branchId },
  });

  return sendSuccess(res, { message: 'Role assigned successfully', data: updated });
});

export const revokeRole = asyncHandler(async (req: AuthRequest, res: Response) => {
  const updated = await studioService.revokeStaffRole(
    req.params.id as string,
    req.user?.id,
    req.user?.role,
    req.tenant
  );

  auditService.record({
    branchId: updated.branchId ?? req.tenant?.branchId,
    actorId: req.user?.id,
    actorRole: req.user?.role,
    action: 'ROLE_CHANGED',
    targetId: updated.id,
    ipAddress: req.ip,
    description: `Revoked staff role for user ${updated.id}`,
    metadata: { newRole: 'MEMBER' },
  });

  return sendSuccess(res, { message: 'Role revoked', data: updated });
});
