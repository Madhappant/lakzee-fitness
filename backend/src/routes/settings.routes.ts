import { Router } from 'express';
import { getSettings, updateSettings } from '../controllers/settings.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', getSettings); // Public so frontend can fetch gym name

router.use(authenticate);
router.put('/', authorize('ADMIN'), updateSettings);

export default router;
