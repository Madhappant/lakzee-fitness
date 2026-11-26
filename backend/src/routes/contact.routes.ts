import { Router } from 'express';
import { submitConsultationInquiry } from '../controllers/contact.controller';

const router = Router();

router.post('/', submitConsultationInquiry);

export default router;
