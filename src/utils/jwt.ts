import jwt from 'jsonwebtoken';
import { config } from '../config';

// Generate access token (short-lived)
export const generateToken = (userId: number, email: string, role: string): string => {
  return jwt.sign(
    { id: userId, email, role },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn } as jwt.SignOptions
  );
};

// Generate refresh token (long-lived)
export const generateRefreshToken = (userId: number): string => {
  return jwt.sign(
    { id: userId, type: 'refresh' },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiresIn } as jwt.SignOptions
  );
};

// Verify access token
export const verifyToken = (token: string): any => {
  try {
    return jwt.verify(token, config.jwt.secret);
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};

// Verify refresh token
export const verifyRefreshToken = (token: string): any => {
  try {
    return jwt.verify(token, config.jwt.refreshSecret);
  } catch (error) {
    throw new Error('Invalid or expired refresh token');
  }
};

// Generate email verification token
export const generateEmailVerificationToken = (userId: number, email: string): string => {
  return jwt.sign(
    { id: userId, email, type: 'email_verification' },
    config.jwt.secret,
    { expiresIn: '24h' } as jwt.SignOptions
  );
};

// Generate password reset token
export const generatePasswordResetToken = (userId: number, email: string): string => {
  return jwt.sign(
    { id: userId, email, type: 'password_reset' },
    config.jwt.secret,
    { expiresIn: '1h' } as jwt.SignOptions
  );
};
