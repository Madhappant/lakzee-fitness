import { Router } from 'express';
import { getAnnouncements, createAnnouncement, deleteAnnouncement } from '../controllers/announcement.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import { createAnnouncementBodySchema } from '../validators/domain.schemas';

const router = Router();

router.use(requireAuth);

router.get('/', getAnnouncements);
router.post('/', requireRole(['SUPER_ADMIN', 'ADMIN']), validateRequest({ body: createAnnouncementBodySchema }), createAnnouncement);
router.delete('/:id', requireRole(['SUPER_ADMIN', 'ADMIN']), deleteAnnouncement);

export default router;
