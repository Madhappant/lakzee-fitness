import { Router } from 'express';
import { getDashboardStats } from '../controllers/dashboard.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);
router.get('/stats', authorize('ADMIN', 'RECEPTIONIST'), getDashboardStats);

export default router;
