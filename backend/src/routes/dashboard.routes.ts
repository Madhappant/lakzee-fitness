import { Router } from 'express';
import { getDashboardStats } from '../controllers/dashboard.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';

const router = Router();

router.use(requireAuth);
router.get('/stats', requireRole(['ADMIN', 'RECEPTIONIST', 'STAFF']), getDashboardStats);

export default router;
