import { Router } from 'express';
import { refreshToken, logout } from '../controllers/tokenController';
import { body } from 'express-validator';
import { handleValidationErrors } from '../middleware/validator';

const router = Router();

router.post(
  '/refresh',
  [body('refreshToken').notEmpty().withMessage('Refresh token is required')],
  handleValidationErrors,
  refreshToken
);

router.post('/logout', logout);

export default router;
