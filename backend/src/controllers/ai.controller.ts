import { Request, Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { asyncHandler } from '../middlewares/error.middleware';
import { studioService } from '../services/studio.service';
import { sendSuccess } from '../utils/response';

export const checkAiStatus = asyncHandler(async (_req: Request, res: Response) => {
  const configured = studioService.isAiConfigured();
  return res.json({
    success: true,
    status: 'success',
    configured,
    data: { configured },
  });
});

export const chatWithAi = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await studioService.chatWithAi(req.body, req.tenant);
  return res.json({
    success: true,
    status: 'success',
    data: result.data,
    ...(result.toolResults ? { toolResults: result.toolResults } : {}),
  });
});

export const voiceAssistant = asyncHandler(async (req: Request, res: Response) => {
  const data = await studioService.voiceAssistant(req.body.messages);
  return sendSuccess(res, { data });
});
