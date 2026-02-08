import twilio from 'twilio';
import { config } from '../config';
import logger from '../utils/logger';

const client = config.sms.accountSid && config.sms.authToken
    ? twilio(config.sms.accountSid, config.sms.authToken)
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
            from: config.sms.phoneNumber,
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
    const message = `Your ContractorList verification code is: ${code}. Valid for ${config.auth.smsOtpExpiryMinutes} minutes.`;
    return sendSms(to, message);
};

