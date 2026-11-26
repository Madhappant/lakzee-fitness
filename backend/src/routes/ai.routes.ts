import express from 'express';
import { checkAiStatus, chatWithAi, voiceAssistant } from '../controllers/ai.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';

const router = express.Router();

router.get('/status', checkAiStatus);

// Strict staff authorization required for admin chat (executes DB mutations)
router.post('/chat', authenticate, authorize('ADMIN', 'RECEPTIONIST'), chatWithAi);

// Public voice assistant (read/navigation only, rate limited at app level)
router.post('/voice', voiceAssistant);

export default router;
