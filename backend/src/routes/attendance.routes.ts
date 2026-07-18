import { Router } from 'express';
import { checkIn, getTodayAttendance } from '../controllers/attendance.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);
router.post('/checkin', authorize('ADMIN', 'RECEPTIONIST'), checkIn);
router.get('/', authorize('ADMIN', 'RECEPTIONIST', 'TRAINER'), getTodayAttendance);

export default router;
