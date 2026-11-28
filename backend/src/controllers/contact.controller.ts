import { Request, Response } from 'express';
import { asyncHandler } from '../middlewares/error.middleware';
import { studioService } from '../services/studio.service';
import { sendSuccess } from '../utils/response';

export const submitConsultationInquiry = asyncHandler(async (req: Request, res: Response) => {
  const inquiry = await studioService.submitConsultationInquiry(req.body);
  return sendSuccess(res, {
    statusCode: 201,
    message: 'Consultation request submitted successfully',
    data: { id: inquiry.id },
  });
});
