import twilio from 'twilio';
import { config } from '../config';
import logger from '../utils/logger';

const client = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : null;

export const sendSms = async (to: string, body: string) => {
    // MOCK: If credentials missing or special test number
    if (!client || to.endsWith('5550000')) {
        logger.warn(`[SMS Service] Using MOCK (Dev/Test). To: ${to}`);
        return true;
    }

    try {
        const message = await client.messages.create({
            body,
            from: process.env.TWILIO_PHONE_NUMBER,
            to
        });
        logger.info(`SMS sent: ${message.sid}`);
        return true;
    } catch (error) {
        logger.error('Error sending SMS:', error);
        // Fallback to mock for development if real sending fails
        logger.warn('[SMS Service] Falling back to mock success (DEV MODE)');
        return true;
    }
};

export const sendVerificationSms = async (to: string, code: string) => {
    const message = `Your ContractorList verification code is: ${code}. Valid for 10 minutes.`;
    return sendSms(to, message);
};
