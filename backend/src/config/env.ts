import { config } from 'dotenv';
config({ path: '.env' });

export const env = {
  PORT: Number(process.env.PORT) || 4000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL: process.env.DATABASE_URL || '',
  REDIS_URL: process.env.REDIS_URL || '',
  ELASTICSEARCH_URL: process.env.ELASTICSEARCH_URL || '',
  FRONTEND_URL: process.env.FRONTEND_URL || '',
  BACKEND_URL: process.env.BACKEND_URL || '',
  COOKIE_SECRET: process.env.COOKIE_SECRET || 'secret',
  JWT_SECRET: process.env.JWT_SECRET || 'jwtsecret',
  ETHEREAL_USER: process.env.ETHEREAL_USER || '',
  ETHEREAL_PASSWORD: process.env.ETHEREAL_PASSWORD || process.env.ETHEREAL_PASS || '',
  ETHEREAL_HOST: process.env.ETHEREAL_HOST || '',
  ETHEREAL_PORT: Number(process.env.ETHEREAL_PORT) || 587,
  ETHEREAL_PASS: process.env.ETHEREAL_PASS || '',
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
  GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL || '',
  SLACK_CLIENT_ID: process.env.SLACK_CLIENT_ID || '',
  SLACK_CLIENT_SECRET: process.env.SLACK_CLIENT_SECRET || '',
  SLACK_REDIRECT_URI: process.env.SLACK_REDIRECT_URI || '',
  WORKER_CONCURRENCY: Number(process.env.WORKER_CONCURRENCY) || 5,
  MIN_EMAIL_DELAY_SECONDS: Number(process.env.MIN_EMAIL_DELAY_SECONDS) || 2,
  MAX_EMAILS_PER_HOUR_PER_SENDER: Number(process.env.MAX_EMAILS_PER_HOUR_PER_SENDER) || 200,
} as const;
