import { Router } from 'express';
import { chatWithAi, checkAiStatus } from '../controllers/ai.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.get('/status', authenticate, checkAiStatus);
router.post('/chat', authenticate, chatWithAi);

export default router;
