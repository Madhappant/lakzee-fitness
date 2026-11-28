import { Router } from 'express';
import { getStaff, assignRole, revokeRole } from '../controllers/staff.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import { assignStaffRoleBodySchema } from '../validators/domain.schemas';

const router = Router();

router.use(requireAuth);
router.use(requireRole(['SUPER_ADMIN', 'ADMIN']));

router.get('/', getStaff);
router.post('/assign', validateRequest({ body: assignStaffRoleBodySchema }), assignRole);
router.post('/:id/revoke', revokeRole);

export default router;
