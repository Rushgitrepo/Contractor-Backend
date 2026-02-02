import rateLimit from 'express-rate-limit';
import { config } from '../config';

// Rate limiter for authentication endpoints
export const authLimiter = rateLimit({
  windowMs: config.rateLimit.authWindowMinutes * 60 * 1000,
  max: config.rateLimit.authMaxAttempts,
  message: {
    success: false,
    message: `Too many login attempts, please try again after ${config.rateLimit.authWindowMinutes} minutes`,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for general API endpoints
export const apiLimiter = rateLimit({
  windowMs: config.rateLimit.apiWindowMinutes * 60 * 1000,
  max: config.rateLimit.apiMaxAttempts,
  message: {
    success: false,
    message: 'Too many requests, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for password reset
export const passwordResetLimiter = rateLimit({
  windowMs: config.rateLimit.passwordResetWindowMinutes * 60 * 1000,
  max: config.rateLimit.passwordResetMaxAttempts,
  message: {
    success: false,
    message: `Too many password reset attempts, please try again after ${config.rateLimit.passwordResetWindowMinutes} minutes`,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

