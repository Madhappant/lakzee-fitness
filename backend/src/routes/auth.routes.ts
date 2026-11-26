import { Router } from 'express';
import { register, login, resetPassword, requestOtp, requestPhoneOtp, verifyPhoneOtp } from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/request-otp', requestOtp);
router.post('/reset-password', resetPassword);
router.post('/request-phone-otp', authenticate, requestPhoneOtp);
router.post('/verify-phone', authenticate, verifyPhoneOtp);

export default router;
