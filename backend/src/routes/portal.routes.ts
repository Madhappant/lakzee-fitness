import { Router } from 'express';
import { getMyProfile, getMyAttendance, getMySubscriptions, uploadPhoto, getMyDietPlan, getMyWorkoutRoutine } from '../controllers/portal.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';
import { upload } from '../middlewares/upload.middleware';

const router = Router();

router.use(requireAuth);
router.use(requireRole(['MEMBER']));

router.get('/me', getMyProfile);
router.get('/attendance', getMyAttendance);
router.get('/subscriptions', getMySubscriptions);
router.post('/photo', upload.single('photo'), uploadPhoto);
router.get('/diet', getMyDietPlan);
router.get('/workout', getMyWorkoutRoutine);

export default router;
