import { Router } from 'express';
import { submitConsultationInquiry } from '../controllers/contact.controller';
import { validateRequest } from '../middlewares/validate.middleware';
import { contactInquiryBodySchema } from '../validators/domain.schemas';

const router = Router();

router.post('/', validateRequest({ body: contactInquiryBodySchema }), submitConsultationInquiry);

export default router;
