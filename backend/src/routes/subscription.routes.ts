import { Router } from 'express';
import { createSubscription, getSubscriptions, getPaymentStats, updateSubscription, deleteSubscription } from '../controllers/subscription.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

router.post('/', authorize('ADMIN', 'RECEPTIONIST'), createSubscription);
router.get('/', authorize('ADMIN', 'RECEPTIONIST'), getSubscriptions);
router.get('/stats', authorize('ADMIN', 'RECEPTIONIST'), getPaymentStats);
router.put('/:id', authorize('ADMIN', 'RECEPTIONIST'), updateSubscription);
router.delete('/:id', authorize('ADMIN', 'RECEPTIONIST'), deleteSubscription);

export default router;
