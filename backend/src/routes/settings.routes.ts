import { Router } from 'express';
import { getSettings, updateSettings } from '../controllers/settings.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import { updateSettingsBodySchema } from '../validators/domain.schemas';

const router = Router();

router.get('/', getSettings);

router.use(requireAuth);
router.put('/', requireRole(['SUPER_ADMIN', 'ADMIN']), validateRequest({ body: updateSettingsBodySchema }), updateSettings);

export default router;
