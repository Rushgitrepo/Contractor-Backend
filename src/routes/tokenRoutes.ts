import { Router } from 'express';
import { refreshToken, logout } from '../controllers/tokenController';
import { body } from 'express-validator';
import { handleValidationErrors } from '../middleware/validator';

const router = Router();

router.post(
  '/refresh',
  refreshToken
);

router.post('/logout', logout);

export default router;
