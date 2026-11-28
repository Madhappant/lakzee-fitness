import { Router } from 'express';
import { triggerExpiryCronJob } from '../controllers/notification.controller';
import { validateRequest } from '../middlewares/validate.middleware';
import { runRemindersBodySchema } from '../validators/domain.schemas';

const router = Router();

router.post(
  '/expiry-reminders',
  validateRequest({ body: runRemindersBodySchema }),
  triggerExpiryCronJob
);

export default router;
