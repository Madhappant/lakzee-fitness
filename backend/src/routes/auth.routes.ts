import { Router } from 'express';
import {
  register,
  login,
  refresh,
  logout,
  resetPassword,
  requestOtp,
  requestPhoneOtp,
  verifyPhoneOtp,
} from '../controllers/auth.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import {
  loginBodySchema,
  registerBodySchema,
  requestOtpBodySchema,
  requestPhoneOtpBodySchema,
  resetPasswordBodySchema,
  verifyPhoneOtpBodySchema,
} from '../validators/domain.schemas';

const router = Router();

router.post('/register', validateRequest({ body: registerBodySchema }), register);
router.post('/login', validateRequest({ body: loginBodySchema }), login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.post('/request-otp', validateRequest({ body: requestOtpBodySchema }), requestOtp);
router.post('/reset-password', validateRequest({ body: resetPasswordBodySchema }), resetPassword);
router.post('/request-phone-otp', requireAuth, validateRequest({ body: requestPhoneOtpBodySchema }), requestPhoneOtp);
router.post('/verify-phone', requireAuth, validateRequest({ body: verifyPhoneOtpBodySchema }), verifyPhoneOtp);

export default router;
