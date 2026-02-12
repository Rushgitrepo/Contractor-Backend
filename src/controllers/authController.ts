import { Request, Response } from 'express';
import pool from '../config/database';
import { comparePassword, hashPassword } from '../utils/password';
import { generateToken, generatePasswordResetToken, verifyToken } from '../utils/jwt';
import { LoginRequest, RegisterRequest } from '../types';
import { HTTP_STATUS, MESSAGES } from '../constants';
import { config } from '../config';
import { sendPasswordResetEmail } from '../services/emailService';

import logger from '../utils/logger';


export const register = async (req: Request, res: Response) => {
  const {
    firstName, lastName, password, workType, phone,
    // Shared
    companyName, companySize, address, role,
    // GC / SC
    yearsInBusiness, projectSizeRange, serviceArea,
    // Supplier
    businessType, deliveryRadius, minOrderValue, offerCreditTerms,
    // Client
    projectType, budgetRange, timeline, propertySize, financingStatus,
    // Arrays
    trades = [], goals = []
  } = req.body as RegisterRequest;

  // Enforce at least one trade and one goal (For Contractors/Suppliers)
  if (workType !== 'client') {
    if (!trades || !Array.isArray(trades) || trades.length === 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'At least one trade must be selected'
      });
    }

    if (!goals || !Array.isArray(goals) || goals.length === 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'At least one goal must be selected'
      });
    }
  }

  // Normalize email
  const email = (req.body.email || '').trim().toLowerCase();

  // Map workType to system role
  // Explicitly mapping to distinct roles now, instead of generic 'contractor'
  let systemRole: 'client' | 'general-contractor' | 'subcontractor' | 'supplier' = 'client';
  if (workType === 'general-contractor') systemRole = 'general-contractor';
  if (workType === 'subcontractor') systemRole = 'subcontractor';
  if (workType === 'supplier') systemRole = 'supplier';

  // Start transaction
  const client = await pool.connect();

  try {
    logger.info(`Registration attempt for email: ${email} [WorkType: ${workType}]`);

    await client.query('BEGIN');

    // 1. Check if user exists in 'users' table
    const userExists = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userExists.rows.length > 0) {
      await client.query('ROLLBACK');
      logger.warn(`Registration failed: User already exists - ${email}`);
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: MESSAGES.USER_EXISTS
      });
    }

    // 2. Hash password
    const hashedPassword = await hashPassword(password);

    // 3. Insert User into 'users' table
    const userRes = await client.query(
      `INSERT INTO users (first_name, last_name, email, password, role, phone, is_verified) 
       VALUES ($1, $2, $3, $4, $5, $6, true) RETURNING id`,
      [firstName, lastName, email, hashedPassword, systemRole, phone]
    );
    const userId = userRes.rows[0].id;

    // 4. Insert Profile based on workType
    if (workType === 'client') {
      await client.query(
        `INSERT INTO client_profiles (user_id, project_type, budget_range, timeline, property_size, financing_status, company_name, property_address, role, interests, goals)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [userId, projectType, budgetRange, timeline, propertySize, financingStatus, companyName, address, role, trades, goals]
      );
    } else if (workType === 'general-contractor') {
      await client.query(
        `INSERT INTO general_contractor_profiles (user_id, company_name, company_size, years_in_business, project_size_range, address, role, trades, goals)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [userId, companyName, companySize, yearsInBusiness, projectSizeRange, address, role, trades, goals]
      );
    } else if (workType === 'subcontractor') {
      await client.query(
        `INSERT INTO sub_contractor_profiles (user_id, company_name, company_size, years_in_business, service_area, address, role, trades, goals)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [userId, companyName, companySize, yearsInBusiness, serviceArea, address, role, trades, goals]
      );
    } else if (workType === 'supplier') {
      await client.query(
        `INSERT INTO supplier_profiles (user_id, company_name, company_size, business_type, years_in_business, delivery_radius, min_order_value, offer_credit_terms, address, role, product_categories, goals)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [userId, companyName, companySize, businessType, yearsInBusiness, deliveryRadius, minOrderValue, offerCreditTerms, address, role, trades, goals]
      );
    }

    // 5. Generate Tokens
    // Force type casting or ensure generateToken accepts 'supplier' if updated, otherwise 'client'/'contractor' is safe if 'supplier' maps to something else in underlying function or if function is updated. 
    // Assuming generateToken handles string or updated type.
    const token = generateToken(userId, email, systemRole as any);

    const { generateRefreshToken } = require('../utils/jwt');
    const refreshToken = generateRefreshToken(userId);

    // 6. Save Refresh Token
    const refreshTokenExpiry = new Date(Date.now() + config.auth.refreshTokenExpiryDays * 24 * 60 * 60 * 1000);
    await client.query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [userId, refreshToken, refreshTokenExpiry]
    );


    await client.query('COMMIT');

    logger.info(`User registered successfully: ${email} [ID: ${userId}]`);

    // Cookie Options
    const cookieOptions = {
      httpOnly: true,
      secure: config.cookies.secure,
      sameSite: config.cookies.sameSite,
      maxAge: config.cookies.maxAgeDays * 24 * 60 * 60 * 1000
    };


    // Set Cookies
    res.cookie('token', token, cookieOptions);
    res.cookie('refreshToken', refreshToken, cookieOptions);

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: MESSAGES.REGISTRATION_SUCCESS || 'Registration successful',
      data: {
        user: {
          id: userId,
          firstName: firstName,
          lastName: lastName,
          email,
          role: systemRole,
          phone,
          company: companyName,
          isVerified: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Registration error details:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: MESSAGES.SERVER_ERROR
    });
  } finally {
    client.release();
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { password } = req.body as LoginRequest;
    const email = (req.body.email || '').trim().toLowerCase();

    console.log(`Login attempt for: ${email}`);

    // Find user in 'users' table - Case Insensitive Check
    const result = await pool.query(
      'SELECT * FROM users WHERE LOWER(email) = LOWER($1)',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: MESSAGES.INVALID_CREDENTIALS,
      });
    }

    const user = result.rows[0];

    // Verify password
    const isPasswordValid = await comparePassword(password, user.password);

    if (!isPasswordValid) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: MESSAGES.INVALID_CREDENTIALS,
      });
    }

    // Generate tokens
    const token = generateToken(user.id, user.email, user.role);
    const { generateRefreshToken } = require('../utils/jwt');
    const refreshToken = generateRefreshToken(user.id);

    // Save refresh token to database
    const refreshTokenExpiry = new Date(Date.now() + config.auth.refreshTokenExpiryDays * 24 * 60 * 60 * 1000);
    await pool.query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, refreshToken, refreshTokenExpiry]
    );


    // Cookie Options
    const cookieOptions = {
      httpOnly: true,
      secure: config.cookies.secure,
      sameSite: config.cookies.sameSite,
      maxAge: config.cookies.maxAgeDays * 24 * 60 * 60 * 1000
    };


    // Set Cookies
    res.cookie('token', token, cookieOptions);
    res.cookie('refreshToken', refreshToken, cookieOptions);

    // Remove password from response and map to camelCase
    const { password: _, ...userWithoutPassword } = user;

    // Map database snake_case fields to camelCase for frontend
    const userResponse = {
      id: userWithoutPassword.id,
      firstName: userWithoutPassword.first_name,
      lastName: userWithoutPassword.last_name,
      email: userWithoutPassword.email,
      role: userWithoutPassword.role,
      phone: userWithoutPassword.phone,
      isVerified: userWithoutPassword.is_verified,
      createdAt: userWithoutPassword.created_at,
      updatedAt: userWithoutPassword.updated_at,
    };

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: MESSAGES.LOGIN_SUCCESS,
      data: {
        user: userResponse,
        token: token, // Include token in response for Postman/testing
        refreshToken: refreshToken, // Include refresh token in response
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: MESSAGES.SERVER_ERROR,
    });
  }
};

export const logout = (req: Request, res: Response) => {
  const cookieOptions = {
    httpOnly: true,
    secure: config.cookies.secure,
    sameSite: config.cookies.sameSite,
  };


  res.clearCookie('token', cookieOptions);
  res.clearCookie('refreshToken', cookieOptions);

  // Also optionally handle DB token invalidation
  // TODO: find and delete the refresh token from the database if necessary

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: 'Logged out successfully'
  });
};

export const getProfile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    // Join with all possible profile tables
    const result = await pool.query(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.role, u.phone, u.is_verified, u.created_at,
              cp.project_type, cp.budget_range, cp.company_name as client_company,
              gcp.company_name as gc_company, gcp.trades as gc_trades,
              scp.company_name as sc_company, scp.trades as sc_trades,
              sp.company_name as supplier_company, sp.product_categories
       FROM users u
       LEFT JOIN client_profiles cp ON u.id = cp.user_id
       LEFT JOIN general_contractor_profiles gcp ON u.id = gcp.user_id
       LEFT JOIN sub_contractor_profiles scp ON u.id = scp.user_id
       LEFT JOIN supplier_profiles sp ON u.id = sp.user_id
       WHERE u.id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: MESSAGES.USER_NOT_FOUND,
      });
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: MESSAGES.SERVER_ERROR,
    });
  }
};



export const sendSmsOtp = async (req: Request, res: Response) => {
  try {
    const phone = (req.body.phone || '').trim();

    if (!phone) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Phone number is required'
      });
    }

    // Generate 6 digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiryMinutes = config.auth.smsOtpExpiryMinutes;
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);


    // Save to DB
    await pool.query(
      'INSERT INTO verification_codes (identifier, type, code, expires_at) VALUES ($1, $2, $3, $4)',
      [phone, 'sms', code, expiresAt]
    );

    // Send SMS
    const { sendVerificationSms } = require('../services/smsService');
    const smsSent = await sendVerificationSms(phone, code);

    if (!smsSent) {
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to send verification SMS (Check logs/credentials)'
      });
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: `Verification code sent to ${phone}`
    });

  } catch (error) {
    console.error('Send SMS OTP error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: MESSAGES.SERVER_ERROR
    });
  }
};

export const verifySmsOtp = async (req: Request, res: Response) => {
  try {
    const phone = (req.body.phone || '').trim();
    const { code } = req.body;

    if (!phone || !code) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Phone and code are required'
      });
    }

    // Check DB for valid code
    const result = await pool.query(
      `SELECT * FROM verification_codes 
       WHERE identifier = $1 AND type = 'sms' AND code = $2 AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [phone, code]
    );

    if (result.rows.length === 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Invalid or expired verification code'
      });
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Phone verified successfully'
    });

  } catch (error) {
    console.error('Verify SMS OTP error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: MESSAGES.SERVER_ERROR
    });
  }
};

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
    const retryMinutes = config.auth.passwordResetTokenExpiryMinutes;
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
