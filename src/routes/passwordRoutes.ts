import { Router } from 'express';
import { forgotPassword, resetPassword } from '../controllers/passwordController';
import { body } from 'express-validator';
import { handleValidationErrors } from '../middleware/validator';
import { passwordResetLimiter } from '../middleware/rateLimiter';

const router = Router();

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
