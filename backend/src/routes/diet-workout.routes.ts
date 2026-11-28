import { Router } from 'express';
import { assignDietPlan, getMemberDietPlan, assignWorkoutRoutine, getMemberWorkoutRoutine } from '../controllers/diet-workout.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import { dietPlanBodySchema, workoutRoutineBodySchema } from '../validators/domain.schemas';

const router = Router();

router.use(requireAuth);

router.post('/diet/:memberId', requireRole(['ADMIN', 'TRAINER', 'STAFF']), validateRequest({ body: dietPlanBodySchema }), assignDietPlan);
router.get('/diet/:memberId', requireRole(['ADMIN', 'TRAINER', 'STAFF', 'MEMBER']), getMemberDietPlan);

router.post('/workout/:memberId', requireRole(['ADMIN', 'TRAINER', 'STAFF']), validateRequest({ body: workoutRoutineBodySchema }), assignWorkoutRoutine);
router.get('/workout/:memberId', requireRole(['ADMIN', 'TRAINER', 'STAFF', 'MEMBER']), getMemberWorkoutRoutine);

export default router;
