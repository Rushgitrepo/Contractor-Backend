import { Router } from 'express';
import {
  login,
  getProfile,
  register,
  sendSmsOtp,
  verifySmsOtp,
  logout,
  forgotPassword,
  resetPassword
} from '../controllers/authController';
import {
  validateLogin,
  handleValidationErrors,
} from '../middleware/validator';
import { authenticate } from '../middleware/auth';
import { authLimiter, passwordResetLimiter } from '../middleware/rateLimiter';
import { validateRequest, registerSchema } from '../middleware/joiValidator';
import { body } from 'express-validator';

const router = Router();

router.post('/register', authLimiter, validateRequest(registerSchema), register);
router.post('/send-sms-otp', authLimiter, sendSmsOtp);
router.post('/verify-sms-otp', authLimiter, verifySmsOtp);
router.post('/login', authLimiter, validateLogin, handleValidationErrors, login);
router.post('/logout', logout);
router.get('/profile', authenticate, getProfile);

// Password Reset Routes
router.post(
  '/forgot-password',
  passwordResetLimiter,
  [body('email').isEmail().withMessage('Valid email is required')],
  handleValidationErrors,
  forgotPassword
);

router.post(
  '/reset-password',
  [
    body('token').notEmpty().withMessage('Token is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain uppercase, lowercase, and number'),
  ],
  handleValidationErrors,
  resetPassword
);

export default router;
