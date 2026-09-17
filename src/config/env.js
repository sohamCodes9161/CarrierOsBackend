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
  // llama-3.3-70b-versatile was deprecated by Groq (announced June 17 2026,
  // shutdown Aug 16 2026) - defaulting to their recommended replacement.
  GROQ_MODEL: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',

  GROQ_STT_MODEL: process.env.GROQ_STT_MODEL || 'whisper-large-v3-turbo',

  // Edge Neural TTS (msedge-tts) - free, no billing account required.
  // Female: en-US-AriaNeural, en-US-AvaNeural. Male: en-US-GuyNeural, en-US-AndrewNeural.
  EDGE_TTS_VOICE: process.env.EDGE_TTS_VOICE || 'en-US-AriaNeural',

  GITHUB_TOKEN: process.env.GITHUB_TOKEN || '', // optional; raises rate limit from 60/hr to 5000/hr
  GITHUB_API_BASE: 'https://api.github.com',
};

export { required };
