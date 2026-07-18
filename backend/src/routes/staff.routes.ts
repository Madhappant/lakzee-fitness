import { Router } from 'express';
import { getStaff, assignRole, revokeRole } from '../controllers/staff.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);
router.use(authorize('ADMIN')); // Only Admins can manage staff roles

router.get('/', getStaff);
router.post('/assign', assignRole);
router.post('/:id/revoke', revokeRole);

export default router;
