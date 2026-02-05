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

export const sendTeamMemberInvitation = async (to: string, name: string, gcName: string, role: string) => {
  const subject = `You're invited to join ${gcName}'s Team on ContractorList`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px; background-color: #ffffff;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="color: #f6d32d; margin: 0;">ContractorList</h1>
      </div>
      <h2 style="color: #333; text-align: center;">Team Invitation</h2>
      <p>Hello <strong>${name}</strong>,</p>
      <p><strong>${gcName}</strong> has added you to their team as a <strong>${role}</strong> on ContractorList.</p>
      <p>ContractorList helps general contractors and their teams manage projects, documents, and communication in one place.</p>
      <div style="margin: 30px 0; text-align: center;">
        <a href="${config.app.frontendUrl}/signup" style="background-color: #f6d32d; color: #000; padding: 14px 35px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">Join Team</a>
      </div>
      <p style="color: #666; font-size: 14px; text-align: center;">If you don't have an account yet, please sign up using this email address to join the team.</p>
      <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;" />
      <p style="color: #999; font-size: 12px; text-align: center;">This is an automated message. Please do not reply to this email.<br>&copy; ${new Date().getFullYear()} ContractorList. All rights reserved.</p>
    </div>
  `;
  return sendEmail(to, subject, html);
};
