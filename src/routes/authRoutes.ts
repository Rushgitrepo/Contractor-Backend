import { Router } from 'express';
import { login, getProfile, register, checkEmail, sendEmailOtp, verifyEmailOtp, sendSmsOtp, verifySmsOtp } from '../controllers/authController';
import {
  validateLogin,
  handleValidationErrors,
} from '../middleware/validator';
import { authenticate } from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimiter';
import { validateRequest, registerSchema } from '../middleware/joiValidator';

const router = Router();

router.post('/register', authLimiter, validateRequest(registerSchema), register);
router.post('/check-email', authLimiter, checkEmail);
router.post('/send-email-otp', authLimiter, sendEmailOtp);
router.post('/verify-email-otp', authLimiter, verifyEmailOtp);
router.post('/send-sms-otp', authLimiter, sendSmsOtp);
router.post('/verify-sms-otp', authLimiter, verifySmsOtp);
router.post('/login', authLimiter, validateLogin, handleValidationErrors, login);
router.get('/profile', authenticate, getProfile);

export default router;
