import rateLimit from 'express-rate-limit';
import { config } from '../config';

// Rate limiter for authentication endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 requests per window
  message: {
    success: false,
    message: 'Too many login attempts, please try again after 15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for general API endpoints
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: {
    success: false,
    message: 'Too many requests, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const passwordResetWindowMinutes = config.rateLimit.passwordResetWindowMinutes;
const passwordResetMax = config.rateLimit.passwordResetMaxAttempts;

// Rate limiter for password reset
export const passwordResetLimiter = rateLimit({
  windowMs: passwordResetWindowMinutes * 60 * 1000,
  max: passwordResetMax,
  message: {
    success: false,
    message: `Too many password reset attempts, please try again after ${passwordResetWindowMinutes} minutes`,
  },
  standardHeaders: true,
  legacyHeaders: false,
});
