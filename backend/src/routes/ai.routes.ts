import { Router } from 'express';
import { chatWithAi } from '../controllers/ai.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.post('/chat', authenticate, chatWithAi);

export default router;
