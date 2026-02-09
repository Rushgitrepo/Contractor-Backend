import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // App
  app: {
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  },

  // Server
  port: parseInt(process.env.PORT || '5000'),
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',

  // Database
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    name: process.env.DB_NAME || 'contractorlist',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'your_secret_key',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRE || '15m', 
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'your_refresh_secret',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRE || '7d',
    emailVerificationExpiresIn: process.env.JWT_EMAIL_VERIFICATION_EXPIRE || '24h',
    passwordResetExpiresIn: process.env.JWT_PASSWORD_RESET_EXPIRE || '1h',
  },

  // Auth Constants
  auth: {
    refreshTokenExpiryDays: parseInt(process.env.REFRESH_TOKEN_EXPIRY_DAYS || '7'),
    emailOtpExpiryMinutes: parseInt(process.env.EMAIL_OTP_EXPIRY_MINUTES || '10'),
    smsOtpExpiryMinutes: parseInt(process.env.SMS_OTP_EXPIRY_MINUTES || '10'),
    passwordResetTokenExpiryMinutes: parseInt(process.env.PASSWORD_RESET_TOKEN_EXPIRY_MINUTES || '60'),
  },

  // Cookies
  cookies: {
    secure: process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production',
    sameSite: (process.env.COOKIE_SAME_SITE || (process.env.NODE_ENV === 'production' ? 'strict' : 'lax')) as 'strict' | 'lax' | 'none',
    maxAgeDays: parseInt(process.env.COOKIE_MAX_AGE_DAYS || '7'),
  },

  // Email
  email: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    user: process.env.SMTP_USER || '',
    password: process.env.SMTP_PASS || '',
    from: process.env.EMAIL_FROM || 'noreply@contractorlist.com',
    fromName: process.env.EMAIL_FROM_NAME || 'ContractorList',
  },

  // SMS
  sms: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    phoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
  },

  // CORS
  cors: {
    origin: (process.env.CORS_ORIGIN || 'http://localhost:3000').split(','),
  },

  // Rate Limiting
  rateLimit: {
    authWindowMinutes: parseInt(process.env.AUTH_LIMIT_WINDOW_MINUTES || '1'),
    authMaxAttempts: parseInt(process.env.AUTH_LIMIT_MAX_ATTEMPTS || '20'),
    apiWindowMinutes: parseInt(process.env.API_LIMIT_WINDOW_MINUTES || '15'),
    apiMaxAttempts: parseInt(process.env.API_LIMIT_MAX_ATTEMPTS || '100'),
    passwordResetWindowMinutes: parseInt(process.env.PASSWORD_RESET_WINDOW_MINUTES || '60'),
    passwordResetMaxAttempts: parseInt(process.env.PASSWORD_RESET_MAX_ATTEMPTS || '3'),
  },
} as const;


