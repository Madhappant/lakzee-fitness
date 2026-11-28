import { Router } from 'express';
import { createSubscription, getSubscriptions, getPaymentStats, updateSubscription, deleteSubscription } from '../controllers/subscription.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import { createSubscriptionBodySchema, updateSubscriptionBodySchema } from '../validators/domain.schemas';

const router = Router();

router.use(requireAuth);

router.post('/', requireRole(['ADMIN', 'RECEPTIONIST', 'STAFF']), validateRequest({ body: createSubscriptionBodySchema }), createSubscription);
router.get('/', requireRole(['ADMIN', 'RECEPTIONIST', 'STAFF']), getSubscriptions);
router.get('/stats', requireRole(['ADMIN', 'RECEPTIONIST', 'STAFF']), getPaymentStats);
router.put('/:id', requireRole(['ADMIN', 'RECEPTIONIST', 'STAFF']), validateRequest({ body: updateSubscriptionBodySchema }), updateSubscription);
router.delete('/:id', requireRole(['SUPER_ADMIN', 'ADMIN']), deleteSubscription);

export default router;
