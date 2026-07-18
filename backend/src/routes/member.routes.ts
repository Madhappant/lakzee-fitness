import { Router } from 'express';
import { createMember, getMembers, getMemberById, deleteMember, updateMember } from '../controllers/member.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

router.post('/', authorize('ADMIN', 'RECEPTIONIST'), createMember);
router.get('/', authorize('ADMIN', 'RECEPTIONIST', 'TRAINER'), getMembers);
router.get('/:id', authorize('ADMIN', 'RECEPTIONIST', 'TRAINER', 'MEMBER'), getMemberById);
router.put('/:id', authorize('ADMIN', 'RECEPTIONIST'), updateMember);
router.delete('/:id', authorize('ADMIN'), deleteMember);

export default router;
