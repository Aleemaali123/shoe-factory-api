import dotenv from 'dotenv';

dotenv.config();

export const env = {
  port: Number(process.env.PORT || 4000),
  jwtSecret: process.env.JWT_SECRET || 'shoe-factory-dev-secret',
  databasePath: process.env.DATABASE_PATH || 'data/shop.db',
  notifyChannel: process.env.NOTIFY_CHANNEL || 'both',
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || '',
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || '',
  twilioSmsFrom: process.env.TWILIO_SMS_FROM || '',
  twilioWhatsappFrom: process.env.TWILIO_WHATSAPP_FROM || '',
};
