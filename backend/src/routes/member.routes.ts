import { Router } from 'express';
import { createMember, getMembers, getMemberById, deleteMember, updateMember } from '../controllers/member.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';
import { upload } from '../middlewares/upload.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import {
  createMemberBodySchema,
  memberSortQuerySchema,
  updateMemberBodySchema,
} from '../validators/domain.schemas';

const router = Router();

router.use(requireAuth);

router.post('/', requireRole(['ADMIN', 'RECEPTIONIST', 'STAFF']), upload.single('photo'), validateRequest({ body: createMemberBodySchema }), createMember);
router.get('/', requireRole(['ADMIN', 'RECEPTIONIST', 'TRAINER', 'STAFF']), validateRequest({ query: memberSortQuerySchema }), getMembers);
router.get('/:id', requireRole(['ADMIN', 'RECEPTIONIST', 'TRAINER', 'STAFF', 'MEMBER']), getMemberById);
router.put('/:id', requireRole(['ADMIN', 'RECEPTIONIST', 'STAFF']), upload.single('photo'), validateRequest({ body: updateMemberBodySchema }), updateMember);
router.delete('/:id', requireRole(['SUPER_ADMIN', 'ADMIN']), deleteMember);

export default router;
