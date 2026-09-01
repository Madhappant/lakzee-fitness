import { Router } from 'express';
import { checkIn, checkOut, getTodayAttendance } from '../controllers/attendance.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);
router.post('/checkin', authorize('ADMIN', 'RECEPTIONIST'), checkIn);
router.post('/checkout', authorize('ADMIN', 'RECEPTIONIST'), checkOut);
router.get('/', authorize('ADMIN', 'RECEPTIONIST', 'TRAINER'), getTodayAttendance);

export default router;
