import dotenv from 'dotenv';

dotenv.config();

function required(key) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || 5000,

  MONGODB_URI: process.env.MONGODB_URI || '', // required at runtime, not at import time (so tests can stub it)

  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'dev_access_secret_change_me',
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || '15m',

  REFRESH_TOKEN_EXPIRES_IN_DAYS: Number(process.env.REFRESH_TOKEN_EXPIRES_IN_DAYS || 7),

  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',

  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || '',
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || '',
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || '',

  GROQ_API_KEY: process.env.GROQ_API_KEY || '',
  GROQ_MODEL: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
  GROQ_STT_MODEL: process.env.GROQ_STT_MODEL || 'whisper-large-v3-turbo',

  EDGE_TTS_VOICE: process.env.EDGE_TTS_VOICE || 'en-US-AriaNeural',

  GITHUB_TOKEN: process.env.GITHUB_TOKEN || '',
  GITHUB_API_BASE: 'https://api.github.com',

  ADZUNA_APP_ID: process.env.ADZUNA_APP_ID || '',
  ADZUNA_APP_KEY: process.env.ADZUNA_APP_KEY || '',
  ADZUNA_COUNTRY: process.env.ADZUNA_COUNTRY || 'us',

  YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY || '',
  GOOGLE_SEARCH_API_KEY: process.env.GOOGLE_SEARCH_API_KEY || '',
  GOOGLE_SEARCH_CX: process.env.GOOGLE_SEARCH_CX || '',

  SMTP_HOST: process.env.SMTP_HOST || 'smtp.gmail.com',
  SMTP_PORT: Number(process.env.SMTP_PORT || 465),
  SMTP_USER: process.env.SMTP_USER || 'carrieros001@gmail.com',
  SMTP_PASS: process.env.SMTP_PASS || '',
  SMTP_FROM: process.env.SMTP_FROM || 'CareerOS <carrieros001@gmail.com>',
  PASSWORD_RESET_TOKEN_EXPIRES_IN_MINUTES: Number(process.env.PASSWORD_RESET_TOKEN_EXPIRES_IN_MINUTES || 15),
  RESET_PASSWORD_URL: process.env.RESET_PASSWORD_URL || 'http://localhost:5173/reset-password',
  BREVO_API_KEY: process.env.BREVO_API_KEY || ''
};

export { required };