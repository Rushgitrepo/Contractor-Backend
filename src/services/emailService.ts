import nodemailer from 'nodemailer';
import logger from '../utils/logger';

import { config } from '../config';

// Create reusable transporter object using the default SMTP transport
const createTransporter = () => {
    // Only use config, assuming config handles loading from env
    const { host, port, user, password: pass } = config.email;

    logger.info(`[EmailService] Configuring transporter with User: ${user ? 'SET' : 'MISSING'}, Host: ${host}`);

    if (!user || !pass) {
        logger.error('[EmailService] CRITICAL: SMTP credentials are missing in config!');
    }

    return nodemailer.createTransport({
        host,
        port,
        secure: false, // true for 465, false for other ports
        auth: {
            user,
            pass,
        },
    });
};

export const sendEmail = async (to: string, subject: string, html: string) => {
    try {
        const transporter = createTransporter();

        const info = await transporter.sendMail({
            from: `"${config.email.fromName}" <${config.email.from}>`, // sender address
            to, // list of receivers
            subject, // Subject line
            html, // html body
        });

        logger.info(`Message sent: ${info.messageId}`);
        return true;
    } catch (error) {
        logger.error('Error sending email:', error);
        return false;
    }
};

export const sendVerificationEmail = async (to: string, code: string) => {
    const subject = 'Verify your email address';
    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Verify your email</h2>
      <p>Thank you for registering. Please use the following code to verify your email address:</p>
      <div style="background-color: #f4f4f4; padding: 15px; text-align: center; border-radius: 5px; margin: 20px 0;">
        <h1 style="color: #333; margin: 0; letter-spacing: 5px;">${code}</h1>
      </div>
      <p>This code will expire in 10 minutes.</p>
      <p>If you didn't request this, please ignore this email.</p>
    </div>
  `;
    return sendEmail(to, subject, html);
};
