import nodemailer from 'nodemailer';
import { config } from '../config';
import logger from './logger';

// Create transporter (only if email is configured)
let transporter: any = null;

if (config.email.user && config.email.password) {
  transporter = nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: false, // true for 465, false for other ports
    auth: {
      user: config.email.user,
      pass: config.email.password,
    },
  });
} else {
  logger.warn('Email not configured. Email features will be disabled.');
}

// Send verification email
export const sendVerificationEmail = async (
  email: string,
  name: string,
  token: string
) => {
  if (!transporter) {
    logger.warn('Email not configured. Skipping verification email.');
    return;
  }

  const verificationUrl = `${config.frontendUrl}/verify-email?token=${token}`;

  console.log('📧 SENDING VERIFICATION EMAIL:');
  console.log('   FROM:', config.email.from);
  console.log('   TO:', email);  // ← This shows the REAL recipient
  console.log('   URL:', verificationUrl);

  try {
    await transporter.sendMail({
      from: `"${config.email.fromName}" <${config.email.from}>`,
      to: email,
      subject: 'Verify Your Email - ContractorList',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Welcome to ContractorList, ${name}!</h2>
          <p>Thank you for registering. Please verify your email address by clicking the button below:</p>
          <a href="${verificationUrl}" 
             style="display: inline-block; padding: 12px 24px; background-color: #EAB308; 
                    color: #000; text-decoration: none; border-radius: 5px; margin: 20px 0;">
            Verify Email
          </a>
          <p>Or copy and paste this link in your browser:</p>
          <p style="color: #666; word-break: break-all;">${verificationUrl}</p>
          <p>This link will expire in 24 hours.</p>
          <p>If you didn't create an account, please ignore this email.</p>
        </div>
      `,
    });
    logger.info(`Verification email sent to ${email}`);
  } catch (error) {
    logger.error(`Failed to send verification email to ${email}:`, error);
    throw new Error('Failed to send verification email');
  }
};

// Send password reset email
export const sendPasswordResetEmail = async (
  email: string,
  name: string,
  token: string
) => {
  if (!transporter) {
    logger.warn('Email not configured. Skipping password reset email.');
    return;
  }

  const resetUrl = `${config.frontendUrl}/reset-password?token=${token}`;

  console.log('📧 SENDING PASSWORD RESET EMAIL:');
  console.log('   FROM:', config.email.from);
  console.log('   TO:', email);  // ← This shows the REAL recipient
  console.log('   URL:', resetUrl);

  try {
    await transporter.sendMail({
      from: `"${config.email.fromName}" <${config.email.from}>`,
      to: email,
      subject: 'Password Reset Request - ContractorList',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Password Reset Request</h2>
          <p>Hi ${name},</p>
          <p>You requested to reset your password. Click the button below to reset it:</p>
          <a href="${resetUrl}" 
             style="display: inline-block; padding: 12px 24px; background-color: #EAB308; 
                    color: #000; text-decoration: none; border-radius: 5px; margin: 20px 0;">
            Reset Password
          </a>
          <p>Or copy and paste this link in your browser:</p>
          <p style="color: #666; word-break: break-all;">${resetUrl}</p>
          <p>This link will expire in 1 hour.</p>
          <p>If you didn't request a password reset, please ignore this email.</p>
        </div>
      `,
    });
    logger.info(`Password reset email sent to ${email}`);
  } catch (error) {
    logger.error(`Failed to send password reset email to ${email}:`, error);
    throw new Error('Failed to send password reset email');
  }
};
