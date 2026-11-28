import { Router } from 'express';
import {
  createBranch,
  getBranchById,
  getBranches,
  updateBranch,
} from '../controllers/branch.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import { createBranchBodySchema, updateBranchBodySchema } from '../validators/domain.schemas';

const router = Router();

router.use(requireAuth);

router.get('/', requireRole(['SUPER_ADMIN', 'BRANCH_ADMIN', 'ADMIN', 'RECEPTIONIST', 'TRAINER', 'STAFF']), getBranches);
router.get('/:id', requireRole(['SUPER_ADMIN', 'BRANCH_ADMIN', 'ADMIN', 'RECEPTIONIST', 'TRAINER', 'STAFF']), getBranchById);
router.post('/', requireRole(['SUPER_ADMIN']), validateRequest({ body: createBranchBodySchema }), createBranch);
router.put('/:id', requireRole(['SUPER_ADMIN']), validateRequest({ body: updateBranchBodySchema }), updateBranch);

export default router;
