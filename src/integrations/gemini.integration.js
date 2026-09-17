import { GoogleGenAI } from '@google/genai';
import { env } from '../config/env.js';
import { AppError } from '../errors/AppError.js';

let client = null;

function getClient() {
  if (!client) {
    if (!env.GEMINI_API_KEY) {
      throw new AppError('AI service is not configured (missing GEMINI_API_KEY)', 503);
    }
    client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  }
  return client;
}

/**
 * Calls Gemini with a JSON schema so the response is guaranteed valid,
 * structured JSON - no free-text parsing anywhere in our codebase.
 */
export async function generateStructuredContent({ prompt, responseSchema }) {
  const ai = getClient();

  const response = await ai.models.generateContent({
    model: env.GEMINI_MODEL,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema,
      temperature: 0.4, // lower temperature for more consistent, evaluative output
    },
  });

  const text = response.text;

  if (!text) {
    throw new AppError('AI service returned an empty response', 502);
  }

  try {
    return JSON.parse(text);
  } catch {
    // Should be rare given responseSchema, but never let malformed AI output crash the app
    throw new AppError('AI service returned malformed data', 502);
  }
}
