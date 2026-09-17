import Groq from 'groq-sdk';
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

/**
 * Maps a Groq/SDK error to a clean AppError for statuses we know how to
 * handle definitively (auth, rate limit, server errors). Returns null for
 * anything else (e.g. a 400 caused by an unsupported response_format),
 * signaling to the caller that a fallback attempt is worth trying.
 */
function mapDefiniteGroqError(err) {
  const status = err?.status || err?.response?.status;

  if (status === 429) {
    return new AppError('AI service is rate-limited right now. Please try again shortly.', 429);
  }
  if (status === 401 || status === 403) {
    return new AppError('AI service authentication failed (check GROQ_API_KEY)', 503);
  }
  if (typeof status === 'number' && status >= 500) {
    return new AppError('AI service is temporarily unavailable', 502);
  }
  return null;
}

async function callGroq({ prompt, schema, schemaName, useStrictSchema }) {
  const groq = getClient();

  const response_format = useStrictSchema
    ? { type: 'json_schema', json_schema: { name: schemaName, strict: true, schema } }
    : { type: 'json_object' };

  // In JSON-object fallback mode there's no schema enforcement from Groq itself,
  // so we embed the schema directly in a system instruction and validate the
  // required fields ourselves afterward (see findMissingRequiredFields below).
  const messages = useStrictSchema
    ? [{ role: 'user', content: prompt }]
    : [
        {
          role: 'system',
          content: `Respond only with valid JSON (the word JSON is required in this instruction), and nothing else, strictly matching this JSON Schema:\n${JSON.stringify(schema)}`,
        },
        { role: 'user', content: prompt },
      ];

  return groq.chat.completions.create({
    model: env.GROQ_MODEL,
    messages,
    response_format,
    temperature: 0.4,
  });
}

/** Verifies top-level required fields are present. Not a full JSON Schema
 * validator, but catches the common failure mode where a model drops a
 * field in the non-strict JSON-object fallback path. */
function findMissingRequiredFields(obj, schema) {
  if (!schema?.required) return [];
  return schema.required.filter((key) => !(key in obj));
}

/**
 * Calls Groq with a JSON schema so the response is structured JSON.
 * Tries strict schema-constrained mode first (guaranteed compliance on
 * models that support it); if that fails for a reason other than auth/
 * rate-limit/server error, falls back to JSON object mode with the schema
 * embedded in the prompt, then validates required fields ourselves - so we
 * never silently accept malformed data even on models with weaker guarantees.
 */
export async function generateStructuredContent({ prompt, responseSchema, schemaName = 'response' }) {
  let response;

  try {
    response = await callGroq({ prompt, schema: responseSchema, schemaName, useStrictSchema: true });
  } catch (err) {
    const definiteError = mapDefiniteGroqError(err);
    if (definiteError) throw definiteError;

    // Likely an unsupported response_format for this model - retry with JSON object mode
    try {
      response = await callGroq({ prompt, schema: responseSchema, schemaName, useStrictSchema: false });
    } catch (fallbackErr) {
      throw mapDefiniteGroqError(fallbackErr) || new AppError('AI service request failed', 502);
    }
  }

  const text = response?.choices?.[0]?.message?.content;
  if (!text) {
    throw new AppError('AI service returned an empty response', 502);
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new AppError('AI service returned malformed data', 502);
  }

  const missing = findMissingRequiredFields(parsed, responseSchema);
  if (missing.length > 0) {
    throw new AppError(`AI service response is missing required fields: ${missing.join(', ')}`, 502);
  }

  return parsed;
}
