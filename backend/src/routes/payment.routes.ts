import { Router } from 'express';
import {
  createMemberRenewalLink,
  createPaymentOrder,
  createPublicRenewalOrder,
  downloadPaymentReceipt,
  downloadPublicRenewalReceipt,
  getPublicRenewalContext,
  handleRazorpayWebhook,
  listPayments,
  verifyPayment,
  verifyPublicRenewalPayment,
} from '../controllers/payment.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import {
  createPaymentOrderBodySchema,
  createRenewalLinkBodySchema,
  paymentListQuerySchema,
  publicRenewalOrderBodySchema,
  verifyPaymentBodySchema,
} from '../validators/domain.schemas';

const router = Router();

// Public webhook endpoint (authenticated strictly via x-razorpay-signature HMAC over rawBody)
router.post('/webhook', handleRazorpayWebhook);

// Public signed one-click renewal links (authenticated strictly via HMAC-SHA256 token)
router.get('/renewal/:token', getPublicRenewalContext);
router.post(
  '/renewal/:token/create-order',
  validateRequest({ body: publicRenewalOrderBodySchema }),
  createPublicRenewalOrder
);
router.post(
  '/renewal/:token/verify',
  validateRequest({ body: verifyPaymentBodySchema }),
  verifyPublicRenewalPayment
);
router.get('/renewal/:token/receipt/:id', downloadPublicRenewalReceipt);

// Authenticated routes (Admin / Staff / Member)
router.use(requireAuth);

router.get(
  '/',
  requireRole(['SUPER_ADMIN', 'BRANCH_ADMIN', 'ADMIN', 'RECEPTIONIST', 'STAFF', 'MEMBER']),
  validateRequest({ query: paymentListQuerySchema }),
  listPayments
);

router.post(
  '/create-order',
  requireRole(['SUPER_ADMIN', 'BRANCH_ADMIN', 'ADMIN', 'RECEPTIONIST', 'STAFF', 'MEMBER']),
  validateRequest({ body: createPaymentOrderBodySchema }),
  createPaymentOrder
);

router.post(
  '/verify',
  requireRole(['SUPER_ADMIN', 'BRANCH_ADMIN', 'ADMIN', 'RECEPTIONIST', 'STAFF', 'MEMBER']),
  validateRequest({ body: verifyPaymentBodySchema }),
  verifyPayment
);

router.post(
  '/renewal-link/:memberId',
  requireRole(['SUPER_ADMIN', 'BRANCH_ADMIN', 'ADMIN', 'RECEPTIONIST', 'STAFF']),
  validateRequest({ body: createRenewalLinkBodySchema }),
  createMemberRenewalLink
);

router.get(
  '/:id/receipt',
  requireRole(['SUPER_ADMIN', 'BRANCH_ADMIN', 'ADMIN', 'RECEPTIONIST', 'STAFF', 'MEMBER']),
  downloadPaymentReceipt
);

export default router;
