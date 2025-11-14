import { Request, Response } from 'express';
import pool from '../config/database';
import { hashPassword, comparePassword } from '../utils/password';
import { generateToken } from '../utils/jwt';
import { RegisterRequest, LoginRequest } from '../types';
import { HTTP_STATUS, MESSAGES } from '../constants';

export const register = async (req: Request, res: Response) => {
  console.log('📝 New user registration');
  const client = await pool.connect();
  
  try {
    const {
      name,
      email,
      password,
      role,
      phone,
      company,
      licenseNumber,
      businessAddress,
      yearsExperience,
      specialties,
      projectType,
      budget,
    } = req.body as RegisterRequest;
    
    console.log('✅ Parsed data:', { name, email, role });

    await client.query('BEGIN');

    // Check if user exists
    const userExists = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (userExists.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: MESSAGES.USER_EXISTS,
      });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Insert user
    const userResult = await client.query(
      `INSERT INTO users (name, email, password, role, phone, company)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, email, role, phone, company, is_verified, created_at`,
      [name, email, hashedPassword, role, phone, company]
    );

    const user = userResult.rows[0];

    // Insert role-specific profile
    if (role === 'contractor') {
      await client.query(
        `INSERT INTO contractor_profiles (user_id, license_number, business_address, years_experience, specialties)
         VALUES ($1, $2, $3, $4, $5)`,
        [user.id, licenseNumber, businessAddress, yearsExperience, specialties]
      );
    } else if (role === 'client') {
      await client.query(
        `INSERT INTO client_profiles (user_id, project_type, budget)
         VALUES ($1, $2, $3)`,
        [user.id, projectType, budget]
      );
    }

    await client.query('COMMIT');

    // Generate tokens
    const token = generateToken(user.id, user.email, user.role);
    const { generateRefreshToken, generateEmailVerificationToken } = require('../utils/jwt');
    const refreshToken = generateRefreshToken(user.id);
    const verificationToken = generateEmailVerificationToken(user.id, user.email);

    // Save refresh token to database
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await client.query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, refreshToken, expiresAt]
    );

    // Save verification token
    await client.query(
      'UPDATE users SET verification_token = $1 WHERE id = $2',
      [verificationToken, user.id]
    );

    // Send verification email (only if email is configured)
    if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
      const { sendVerificationEmail } = require('../utils/email');
      sendVerificationEmail(user.email, user.name, verificationToken).catch((err: any) => {
        // Silently fail - don't block registration
        console.log('⚠️ Email not sent (email service not configured)');
      });
    } else {
      console.log('ℹ️ Email service not configured - skipping verification email');
    }

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: MESSAGES.REGISTRATION_SUCCESS,
      data: {
        user,
        token,
        refreshToken,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Registration error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: MESSAGES.SERVER_ERROR,
    });
  } finally {
    client.release();
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as LoginRequest;

    // Find user
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
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

    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.phone, u.company, u.is_verified, u.created_at,
              cp.license_number, cp.business_address, cp.years_experience, cp.specialties,
              clp.project_type, clp.budget
       FROM users u
       LEFT JOIN contractor_profiles cp ON u.id = cp.user_id
       LEFT JOIN client_profiles clp ON u.id = clp.user_id
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
