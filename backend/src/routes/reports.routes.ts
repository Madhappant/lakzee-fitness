import { Router } from 'express';
import { getReports } from '../controllers/reports.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';

const router = Router();

router.use(requireAuth);
router.get('/', requireRole(['SUPER_ADMIN', 'ADMIN']), getReports);

export default router;
