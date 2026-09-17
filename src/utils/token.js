import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env.js';

/** Signs a short-lived JWT access token carrying the user id. */
export function signAccessToken(userId) {
  return jwt.sign({ sub: userId.toString() }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  });
}

/** Verifies and decodes an access token; throws if invalid/expired. */
export function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET);
}

/**
 * Refresh tokens are NOT JWTs - they're opaque random strings.
 * We only ever store a hash of them in the DB (like a password),
 * so a DB leak alone can't be used to impersonate a session.
 */
export function generateRefreshToken() {
  const raw = crypto.randomBytes(40).toString('hex');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  const expiresAt = new Date(
    Date.now() + env.REFRESH_TOKEN_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000
  );
  return { raw, hash, expiresAt };
}

export function hashRefreshToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}
