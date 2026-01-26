import { Request, Response } from 'express';
import pool from '../config/database';
import { comparePassword } from '../utils/password';
import { generateToken } from '../utils/jwt';
import { LoginRequest } from '../types';
import { HTTP_STATUS, MESSAGES } from '../constants';

import { hashPassword } from '../utils/password';
import { RegisterRequest } from '../types';

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
    trades, goals
  } = req.body as RegisterRequest;

  // Normalize email
  const email = (req.body.email || '').trim().toLowerCase();

  // Map workType to system role
  let systemRole: 'client' | 'contractor' | 'vendor' = 'client';
  if (workType === 'general-contractor' || workType === 'subcontractor') systemRole = 'contractor';
  if (workType === 'supplier') systemRole = 'vendor';

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
       VALUES ($1, $2, $3, $4, $5, $6, false) RETURNING id`,
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
    // Force type casting or ensure generateToken accepts 'vendor' if updated, otherwise 'client'/'contractor' is safe if 'vendor' maps to something else in underlying function or if function is updated. 
    // Assuming generateToken handles string or updated type.
    const token = generateToken(userId, email, systemRole as any);
    const { generateRefreshToken } = require('../utils/jwt');
    const refreshToken = generateRefreshToken(userId);

    // 6. Save Refresh Token
    await client.query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [userId, refreshToken, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)] // 7 days
    );

    await client.query('COMMIT');

    logger.info(`User registered successfully: ${email} [ID: ${userId}]`);

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: MESSAGES.REGISTRATION_SUCCESS || 'Registration successful',
      data: {
        user: {
          id: userId,
          first_name: firstName,
          last_name: lastName,
          email,
          role: systemRole,
          phone,
          company: companyName,
          is_verified: false,
          created_at: new Date(),
          updated_at: new Date()
        },
        token,
        refreshToken
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
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await pool.query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, refreshToken, expiresAt]
    );

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: MESSAGES.LOGIN_SUCCESS,
      data: {
        user: userWithoutPassword,
        token,
        refreshToken,
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
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

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
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

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
