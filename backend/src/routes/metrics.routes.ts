import { Router } from 'express';
import { getObservabilityMetrics } from '../controllers/metrics.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';

const router = Router();

router.use(requireAuth);
router.get('/', requireRole(['SUPER_ADMIN', 'ADMIN']), getObservabilityMetrics);

export default router;
