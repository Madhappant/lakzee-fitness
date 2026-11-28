import express from 'express';
import { checkAiStatus, chatWithAi, voiceAssistant } from '../controllers/ai.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import { aiChatBodySchema, aiVoiceBodySchema } from '../validators/domain.schemas';

const router = express.Router();

router.get('/status', checkAiStatus);
router.post('/chat', requireAuth, requireRole(['SUPER_ADMIN', 'ADMIN', 'RECEPTIONIST', 'STAFF']), validateRequest({ body: aiChatBodySchema }), chatWithAi);
router.post('/voice', validateRequest({ body: aiVoiceBodySchema }), voiceAssistant);

export default router;
