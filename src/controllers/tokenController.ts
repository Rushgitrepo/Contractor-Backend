import { Request, Response } from 'express';
import pool from '../config/database';
import { generateToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { HTTP_STATUS, MESSAGES } from '../constants';
import logger from '../utils/logger';

// Refresh access token
export const refreshToken = async (req: Request, res: Response) => {
  try {
    const oldRefreshToken = req.cookies.refreshToken;

    if (!oldRefreshToken) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Refresh token is required',
      });
    }

    // Verify refresh token
    const decoded = verifyRefreshToken(oldRefreshToken);

    if (decoded.type !== 'refresh') {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: 'Invalid refresh token',
      });
    }

    // Check if refresh token exists in database (detection for reuse)
    const tokenResult = await pool.query(
      'SELECT * FROM refresh_tokens WHERE token = $1 AND user_id = $2 AND expires_at > NOW()',
      [oldRefreshToken, decoded.id]
    );

    if (tokenResult.rows.length === 0) {
      // Possible token reuse or compromise
      // In a real production app, we might want to invalidate all tokens for this user
      logger.warn(`Potential refresh token reuse detected for user ID: ${decoded.id}`);
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: 'Invalid or expired refresh token',
      });
    }

    // Delete the old token (rotation)
    await pool.query('DELETE FROM refresh_tokens WHERE token = $1', [oldRefreshToken]);

    // Get user details
    const userResult = await pool.query(
      'SELECT id, email, role FROM users WHERE id = $1',
      [decoded.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: MESSAGES.USER_NOT_FOUND,
      });
    }

    const user = userResult.rows[0];

    // Generate new access token
    const newAccessToken = generateToken(user.id, user.email, user.role);
    // Generate new refresh token (ROTATION)
    const newRefreshToken = generateRefreshToken(user.id);

    // Save new refresh token to database
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await pool.query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, newRefreshToken, expiresAt]
    );

    logger.info(`Access token rotated for user: ${user.email}`);

    // Set Cookies
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: (process.env.NODE_ENV === 'production' ? 'strict' : 'lax') as 'strict' | 'lax' | 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/', // Make accessible on all paths
    };

    res.cookie('token', newAccessToken, cookieOptions);
    res.cookie('refreshToken', newRefreshToken, cookieOptions);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Token refreshed successfully',
      data: {},
    });
  } catch (error) {
    logger.error('Refresh token error:', error);
    res.status(HTTP_STATUS.UNAUTHORIZED).json({
      success: false,
      message: 'Invalid or expired refresh token',
    });
  }
};

// Logout (invalidate refresh token)
export const logout = async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: (process.env.NODE_ENV === 'production' ? 'strict' : 'lax') as 'strict' | 'lax' | 'none',
    };

    if (refreshToken) {
      await pool.query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
    }

    res.clearCookie('token', cookieOptions);
    res.clearCookie('refreshToken', cookieOptions);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: MESSAGES.SERVER_ERROR,
    });
  }
};