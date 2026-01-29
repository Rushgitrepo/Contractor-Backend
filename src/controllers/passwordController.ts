import { Request, Response } from 'express';
import pool from '../config/database';
import { config } from '../config';
import { hashPassword } from '../utils/password';
import { generatePasswordResetToken, verifyToken } from '../utils/jwt';
import { sendPasswordResetEmail } from '../utils/email';
import { HTTP_STATUS, MESSAGES } from '../constants';
import logger from '../utils/logger';

// Request password reset
export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    const result = await pool.query(
      'SELECT id, first_name, email FROM users WHERE email = $1',
      [email]
    );

    // Always return success to prevent email enumeration
    if (result.rows.length === 0) {
      return res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'If the email exists, a password reset link has been sent',
      });
    }

    const user = result.rows[0];

    // Generate reset token
    const token = generatePasswordResetToken(user.id, user.email);
    const retryMinutes = config.security.passwordResetTokenExpiryMinutes;
    const expiresAt = new Date(Date.now() + retryMinutes * 60 * 1000);

    // Save token to database
    await pool.query(
      'UPDATE users SET reset_password_token = $1, reset_password_expires = $2 WHERE id = $3',
      [token, expiresAt, user.id]
    );

    // Send email
    await sendPasswordResetEmail(user.email, user.first_name, token);

    logger.info(`Password reset email sent to: ${email}`);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'If the email exists, a password reset link has been sent',
    });
  } catch (error: any) {
    logger.error('Forgot password error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: `Error: ${error.message || error}`,
    });
  }
};

// Reset password
export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Token and new password are required',
      });
    }

    // Verify token
    const decoded = verifyToken(token);

    if (decoded.type !== 'password_reset') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Invalid reset token',
      });
    }

    // Check if token exists and not expired
    const result = await pool.query(
      'SELECT id, email FROM users WHERE id = $1 AND email = $2 AND reset_password_token = $3 AND reset_password_expires > NOW()',
      [decoded.id, decoded.email, token]
    );

    if (result.rows.length === 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Invalid or expired reset token',
      });
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update password and clear reset token
    await pool.query(
      'UPDATE users SET password = $1, reset_password_token = NULL, reset_password_expires = NULL WHERE id = $2',
      [hashedPassword, decoded.id]
    );

    logger.info(`Password reset successful for user: ${decoded.email}`);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Password reset successfully',
    });
  } catch (error) {
    logger.error('Reset password error:', error);
    res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      message: 'Invalid or expired reset token',
    });
  }
};