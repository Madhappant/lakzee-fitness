import { Router } from 'express';
import { createPlan, getPlans, updatePlan, deletePlan } from '../controllers/plan.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import { createPlanBodySchema, updatePlanBodySchema } from '../validators/domain.schemas';

const router = Router();

router.get('/', getPlans);

router.use(requireAuth);
router.post('/', requireRole(['SUPER_ADMIN', 'ADMIN']), validateRequest({ body: createPlanBodySchema }), createPlan);
router.put('/:id', requireRole(['SUPER_ADMIN', 'ADMIN']), validateRequest({ body: updatePlanBodySchema }), updatePlan);
router.delete('/:id', requireRole(['SUPER_ADMIN', 'ADMIN']), deletePlan);

export default router;
