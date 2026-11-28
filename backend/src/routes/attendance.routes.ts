import { Router } from 'express';
import { checkIn, checkOut, getTodayAttendance } from '../controllers/attendance.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import { attendanceScanBodySchema } from '../validators/domain.schemas';

const router = Router();

router.use(requireAuth);
router.post('/checkin', requireRole(['ADMIN', 'RECEPTIONIST', 'STAFF']), validateRequest({ body: attendanceScanBodySchema }), checkIn);
router.post('/checkout', requireRole(['ADMIN', 'RECEPTIONIST', 'STAFF']), validateRequest({ body: attendanceScanBodySchema }), checkOut);
router.get('/', requireRole(['ADMIN', 'RECEPTIONIST', 'TRAINER', 'STAFF']), getTodayAttendance);

export default router;
