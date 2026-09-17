import Groq, { toFile } from 'groq-sdk';
import { env } from '../config/env.js';
import { AppError } from '../errors/AppError.js';

let client = null;

function getClient() {
  if (!client) {
    if (!env.GROQ_API_KEY) {
      throw new AppError('AI service is not configured (missing GROQ_API_KEY)', 503);
    }
    client = new Groq({ apiKey: env.GROQ_API_KEY });
  }
  return client;
}

function mapGroqAudioError(err) {
  const status = err?.status || err?.response?.status;
  if (status === 429) {
    return new AppError('AI voice service is rate-limited right now. Please try again shortly.', 429);
  }
  if (status === 401 || status === 403) {
    return new AppError('AI voice service authentication failed (check GROQ_API_KEY)', 503);
  }
  if (typeof status === 'number' && status >= 500) {
    return new AppError('AI voice service is temporarily unavailable', 502);
  }
  return new AppError('AI voice service request failed', 502);
}

/**
 * Transcribes a recorded answer to text via Groq's Whisper endpoint.
 * Accepts common browser recording formats directly (webm, ogg, wav, mp3, m4a).
 */
export async function transcribeAudio(buffer, filename, mimetype) {
  const groq = getClient();

  try {
    const file = await toFile(buffer, filename, { type: mimetype });
    const result = await groq.audio.transcriptions.create({
      file,
      model: env.GROQ_STT_MODEL,
      language: 'en',
      response_format: 'json',
    });

    const text = result?.text?.trim();
    if (!text) {
      throw new AppError('Could not transcribe any speech from the recording', 400);
    }
    return text;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw mapGroqAudioError(err);
  }
}
