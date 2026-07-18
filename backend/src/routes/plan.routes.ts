import { Router } from 'express';
import { createPlan, getPlans, updatePlan, deletePlan } from '../controllers/plan.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', getPlans); // Publicly accessible to see plans

router.use(authenticate);

router.post('/', authorize('ADMIN'), createPlan);
router.put('/:id', authorize('ADMIN'), updatePlan);
router.delete('/:id', authorize('ADMIN'), deletePlan);

export default router;
