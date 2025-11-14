import { Router } from 'express';
import { register, login, getProfile } from '../controllers/authController';
import {
  validateRegister,
  validateLogin,
  handleValidationErrors,
} from '../middleware/validator';
import { authenticate } from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimiter';

const router = Router();

router.post('/register', authLimiter, validateRegister, handleValidationErrors, register);
router.post('/login', authLimiter, validateLogin, handleValidationErrors, login);
router.get('/profile', authenticate, getProfile);

export default router;
