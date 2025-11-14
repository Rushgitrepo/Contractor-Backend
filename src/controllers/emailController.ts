import { Request, Response } from 'express';
import pool from '../config/database';
import { verifyToken } from '../utils/jwt';
import { HTTP_STATUS, MESSAGES } from '../constants';
import logger from '../utils/logger';

// Verify email
export const verifyEmail = async (req: Request, res: Response) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Verification token is required',
      });
    }

    // Verify token
    const decoded = verifyToken(token);

    if (decoded.type !== 'email_verification') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Invalid verification token',
      });
    }

    // Update user verification status
    const result = await pool.query(
      'UPDATE users SET is_verified = true, verification_token = NULL WHERE id = $1 AND email = $2 RETURNING id, email, is_verified',
      [decoded.id, decoded.email]
    );

    if (result.rows.length === 0) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: MESSAGES.USER_NOT_FOUND,
      });
    }

    logger.info(`Email verified for user: ${decoded.email}`);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Email verified successfully',
      data: result.rows[0],
    });
  } catch (error) {
    logger.error('Email verification error:', error);
    res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      message: 'Invalid or expired verification token',
    });
  }
};

// Resend verification email
export const resendVerificationEmail = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    const result = await pool.query(
      'SELECT id, name, email, is_verified FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: MESSAGES.USER_NOT_FOUND,
      });
    }

    const user = result.rows[0];

    if (user.is_verified) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Email is already verified',
      });
    }

    // Generate new verification token
    const { generateEmailVerificationToken } = require('../utils/jwt');
    const { sendVerificationEmail } = require('../utils/email');
    
    const token = generateEmailVerificationToken(user.id, user.email);

    // Save token to database
    await pool.query(
      'UPDATE users SET verification_token = $1 WHERE id = $2',
      [token, user.id]
    );

    // Send email
    await sendVerificationEmail(user.email, user.name, token);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Verification email sent successfully',
    });
  } catch (error) {
    logger.error('Resend verification email error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: MESSAGES.SERVER_ERROR,
    });
  }
};