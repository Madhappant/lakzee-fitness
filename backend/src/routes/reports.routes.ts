import { Router } from 'express';
import { getReports } from '../controllers/reports.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);
router.get('/', authorize('ADMIN'), getReports);

export default router;
