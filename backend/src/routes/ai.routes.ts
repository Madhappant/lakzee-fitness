import express from 'express';
import { checkAiStatus, chatWithAi, voiceAssistant } from '../controllers/ai.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = express.Router();

router.get('/status', checkAiStatus);

// Auth required for admin chat
router.post('/chat', authenticate, chatWithAi);

// No auth required for public voice assistant
router.post('/voice', voiceAssistant);

export default router;
