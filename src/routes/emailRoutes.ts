import { Router } from 'express';
import {
  verifyEmail,
  resendVerificationEmail,
  checkEmail,
  sendEmailOtp,
  verifyEmailOtp,
} from '../controllers/emailController';
import { body } from 'express-validator';
import { handleValidationErrors } from '../middleware/validator';
import { authLimiter } from '../middleware/rateLimiter';

const router = Router();

router.get('/verify', verifyEmail);
router.post(
  '/resend-verification',
  [body('email').isEmail().withMessage('Valid email is required')],
  handleValidationErrors,
  resendVerificationEmail
);

router.post('/check', authLimiter, checkEmail);
router.post('/send-otp', authLimiter, sendEmailOtp);
router.post('/verify-otp', authLimiter, verifyEmailOtp);

export default router;
