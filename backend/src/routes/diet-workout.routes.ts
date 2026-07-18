import { Router } from 'express';
import { assignDietPlan, getMemberDietPlan, assignWorkoutRoutine, getMemberWorkoutRoutine } from '../controllers/diet-workout.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';

const router = Router();

// Routes for ADMIN to assign plans to a specific member
router.post('/diet/:memberId', authenticate, authorize(['ADMIN', 'TRAINER']), assignDietPlan);
router.get('/diet/:memberId', authenticate, authorize(['ADMIN', 'TRAINER', 'MEMBER']), getMemberDietPlan);

router.post('/workout/:memberId', authenticate, authorize(['ADMIN', 'TRAINER']), assignWorkoutRoutine);
router.get('/workout/:memberId', authenticate, authorize(['ADMIN', 'TRAINER', 'MEMBER']), getMemberWorkoutRoutine);

export default router;
