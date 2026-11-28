import { Router } from 'express';
import {
  getNotificationLogs,
  getNotifications,
  retryNotificationLog,
  runRemindersNow,
  sendManualNotification,
} from '../controllers/notification.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import {
  notificationLogsQuerySchema,
  runRemindersBodySchema,
  sendManualReminderBodySchema,
} from '../validators/domain.schemas';

const router = Router();

router.use(requireAuth);

router.get('/', getNotifications);
router.get(
  '/logs',
  requireRole(['SUPER_ADMIN', 'BRANCH_ADMIN', 'ADMIN']),
  validateRequest({ query: notificationLogsQuerySchema }),
  getNotificationLogs
);
router.post(
  '/send',
  requireRole(['SUPER_ADMIN', 'BRANCH_ADMIN', 'ADMIN']),
  validateRequest({ body: sendManualReminderBodySchema }),
  sendManualNotification
);
router.post(
  '/logs/:id/retry',
  requireRole(['SUPER_ADMIN', 'BRANCH_ADMIN', 'ADMIN']),
  retryNotificationLog
);
router.post(
  '/run',
  requireRole(['SUPER_ADMIN', 'BRANCH_ADMIN', 'ADMIN']),
  validateRequest({ body: runRemindersBodySchema }),
  runRemindersNow
);

export default router;
