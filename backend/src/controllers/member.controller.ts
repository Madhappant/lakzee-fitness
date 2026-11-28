import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { asyncHandler } from '../middlewares/error.middleware';
import { auditService } from '../services/audit.service';
import { memberService } from '../services/member.service';
import { BadRequestError } from '../utils/errors';
import { sendSuccess } from '../utils/response';
import { resolveWriteBranchId } from '../utils/tenant';

const parseOptionalDate = (val?: string): Date | null | undefined => {
  if (val === undefined) return undefined;
  const trimmed = val.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  if (isNaN(parsed.getTime())) {
    throw new BadRequestError('Invalid date of birth');
  }
  return parsed;
};

function resolveUploadedPhotoUrl(file?: Express.Multer.File): string | undefined {
  if (!file) return undefined;
  if ((process.env.CLOUDINARY_URL || process.env.CLOUDINARY_CLOUD_NAME) && file.path.startsWith('http')) {
    return file.path;
  }
  return `/uploads/${file.filename}`;
}

export const createMember = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { dob, branchId: bodyBranchId, ...rest } = req.body;
  const resolvedBranchId = resolveWriteBranchId({
    userRole: req.user?.role,
    userBranchId: req.user?.branchId,
    requestedBranchId: bodyBranchId ?? req.tenant?.branchId,
  });

  const newMember = await memberService.createMember({
    ...rest,
    branchId: resolvedBranchId,
    dob: parseOptionalDate(dob),
    photoUrl: resolveUploadedPhotoUrl(req.file),
  });

  auditService.record({
    branchId: resolvedBranchId,
    actorId: req.user?.id,
    actorRole: req.user?.role,
    action: 'MEMBER_CREATED',
    targetId: newMember.id,
    ipAddress: req.ip,
    description: `Created member profile ${newMember.memberProfile?.memberId ?? newMember.id}`,
    metadata: { memberId: newMember.memberProfile?.memberId, branchId: resolvedBranchId },
  });

  return sendSuccess(res, { statusCode: 201, data: newMember });
});

export const getMembers = asyncHandler(async (req: AuthRequest, res: Response) => {
  const querySource = req.validated?.query ?? req.query;
  const sortParam = querySource.sort;
  const limitParam = querySource.limit !== undefined ? Number(querySource.limit) : undefined;
  const cursorParam = typeof querySource.cursor === 'string' ? querySource.cursor : undefined;
  const branchId = req.tenant?.branchId ?? null;

  const { members, total, nextCursor, hasMore, sortOrder, cached } = await memberService.listMembers(
    sortParam,
    {
      branchId,
      limit: Number.isFinite(limitParam) ? limitParam : undefined,
      cursor: cursorParam,
    }
  );

  return sendSuccess(res, {
    data: members,
    meta: {
      total,
      count: members.length,
      sort: sortOrder,
      cached,
      branchId: branchId ?? 'all',
      limit: limitParam ?? total,
      nextCursor,
      hasMore,
    },
  });
});

export const getMemberById = asyncHandler(async (req: AuthRequest, res: Response) => {
  const member = await memberService.getMemberById(req.params.id as string, req.user, req.tenant);
  return sendSuccess(res, { data: member });
});

export const updateMember = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { dob, ...rest } = req.body;
  const targetId = req.params.id as string;
  const updatedMember = await memberService.updateMember(
    targetId,
    {
      ...rest,
      dob: parseOptionalDate(dob),
      photoUrl: resolveUploadedPhotoUrl(req.file),
    },
    req.tenant
  );

  auditService.record({
    branchId: updatedMember.branchId ?? req.tenant?.branchId,
    actorId: req.user?.id,
    actorRole: req.user?.role,
    action: 'MEMBER_UPDATED',
    targetId,
    ipAddress: req.ip,
    description: `Updated member profile ${updatedMember.memberProfile?.memberId ?? targetId}`,
    metadata: { updatedFields: Object.keys(rest) },
  });

  return sendSuccess(res, { data: updatedMember });
});

export const deleteMember = asyncHandler(async (req: AuthRequest, res: Response) => {
  const targetId = req.params.id as string;
  const removed = await memberService.deleteMember(targetId, req.tenant);

  auditService.record({
    branchId: removed.branchId ?? req.tenant?.branchId,
    actorId: req.user?.id,
    actorRole: req.user?.role,
    action: 'MEMBER_DELETED',
    targetId,
    ipAddress: req.ip,
    description: `Deleted member record ${removed.id}`,
  });

  return sendSuccess(res, { message: 'Member deleted successfully' });
});
