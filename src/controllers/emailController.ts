import { Request, Response } from 'express';
import pool from '../config/database';
import { verifyToken } from '../utils/jwt';
import { HTTP_STATUS, MESSAGES } from '../constants';
import logger from '../utils/logger';
import { config } from '../config';

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
    const { sendVerificationLinkEmail } = require('../services/emailService');

    const token = generateEmailVerificationToken(user.id, user.email);


    // Save token to database
    await pool.query(
      'UPDATE users SET verification_token = $1 WHERE id = $2',
      [token, user.id]
    );

    // Send email
    await sendVerificationLinkEmail(user.email, user.name, token);


    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Verification email sent successfully',
    });
  } catch (error) {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: MESSAGES.SERVER_ERROR,
    });
  }
};

export const checkEmail = async (req: Request, res: Response) => {
  try {
    const email = (req.body.email || '').trim().toLowerCase();

    if (!email) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Email is required',
      });
    }

    const result = await pool.query('SELECT id FROM users WHERE email = $1', [email]);

    if (result.rows.length > 0) {
      return res.status(HTTP_STATUS.OK).json({
        success: true,
        exists: true,
        message: 'Email already exists',
      });
    }

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      exists: false,
      message: 'Email is available',
    });
  } catch (error) {
    console.error('Check email error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: MESSAGES.SERVER_ERROR,
    });
  }
};

export const sendEmailOtp = async (req: Request, res: Response) => {
  try {
    const email = (req.body.email || '').trim().toLowerCase();

    if (!email) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Email is required'
      });
    }

    // Generate 6 digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiryMinutes = config.auth.emailOtpExpiryMinutes;
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);


    // Save to DB
    await pool.query(
      'INSERT INTO verification_codes (identifier, type, code, expires_at) VALUES ($1, $2, $3, $4)',
      [email, 'email', code, expiresAt]
    );

    // Send Email
    const { sendVerificationEmail } = require('../services/emailService');
    const emailSent = await sendVerificationEmail(email, code);

    if (!emailSent) {
      logger.error(`[Auth] Failed to send verification email to: ${email}`);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to send verification email'
      });
    }

    logger.info(`[Auth] Verification code sent to: ${email}`);
    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: `Verification code sent to ${email}`
    });

  } catch (error) {
    logger.error('[Auth] Send OTP error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: MESSAGES.SERVER_ERROR
    });
  }
};

export const verifyEmailOtp = async (req: Request, res: Response) => {
  try {
    const email = (req.body.email || '').trim().toLowerCase();
    const { code } = req.body;

    if (!email || !code) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Email and code are required'
      });
    }

    logger.info(`[Auth] Verifying OTP for: ${email}`);

    // Check DB for valid code
    const result = await pool.query(
      `SELECT * FROM verification_codes 
       WHERE identifier = $1 AND type = 'email' AND code = $2 AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [email, code]
    );

    if (result.rows.length === 0) {
      logger.warn(`[Auth] Invalid or expired OTP for: ${email}`);
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Invalid or expired verification code'
      });
    }

    logger.info(`[Auth] OTP verified successfully for: ${email}`);
    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Email verified successfully'
    });

  } catch (error) {
    logger.error('[Auth] Verify OTP error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: MESSAGES.SERVER_ERROR
    });
  }
};