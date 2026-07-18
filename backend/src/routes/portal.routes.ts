import { Router } from 'express';
import { getMyProfile, getMyAttendance, getMySubscriptions, uploadPhoto, getMyDietPlan, getMyWorkoutRoutine } from '../controllers/portal.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { upload } from '../middlewares/upload.middleware';

const router = Router();

// All portal routes require the user to be authenticated and have the MEMBER role
router.use(authenticate);
router.use(authorize('MEMBER'));

router.get('/me', getMyProfile);
router.get('/attendance', getMyAttendance);
router.get('/subscriptions', getMySubscriptions);
router.post('/photo', upload.single('photo'), uploadPhoto);
router.get('/diet', getMyDietPlan);
router.get('/workout', getMyWorkoutRoutine);

export default router;
