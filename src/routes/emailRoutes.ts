import { Router } from 'express';
import { verifyEmail, resendVerificationEmail } from '../controllers/emailController';
import { body } from 'express-validator';
import { handleValidationErrors } from '../middleware/validator';

const router = Router();

router.get('/verify', verifyEmail);
router.post(
  '/resend-verification',
  [body('email').isEmail().withMessage('Valid email is required')],
  handleValidationErrors,
  resendVerificationEmail
);

export default router;
