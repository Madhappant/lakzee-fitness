import { Router } from 'express';
import { register, login, resetPassword, requestOtp, requestPhoneOtp, verifyPhoneOtp } from '../controllers/auth.controller';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/request-otp', requestOtp);
router.post('/reset-password', resetPassword);
router.post('/request-phone-otp', requestPhoneOtp);
router.post('/verify-phone', verifyPhoneOtp);

export default router;
