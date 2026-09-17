import { describe, it, expect } from '@jest/globals';
import {
  signAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  hashRefreshToken,
} from '../src/utils/token.js';

describe('token utils', () => {
  it('signs an access token that verifies back to the same user id', () => {
    const token = signAccessToken('64f000000000000000000001');
    const decoded = verifyAccessToken(token);
    expect(decoded.sub).toBe('64f000000000000000000001');
  });

  it('throws when verifying a tampered token', () => {
    const token = signAccessToken('64f000000000000000000001');
    const tampered = token.slice(0, -2) + 'xx';
    expect(() => verifyAccessToken(tampered)).toThrow();
  });

  it('generates a refresh token whose hash matches hashRefreshToken(raw)', () => {
    const { raw, hash } = generateRefreshToken();
    expect(hashRefreshToken(raw)).toBe(hash);
  });

  it('generates a refresh token with a future expiry date', () => {
    const { expiresAt } = generateRefreshToken();
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('generates unique raw tokens on each call', () => {
    const a = generateRefreshToken();
    const b = generateRefreshToken();
    expect(a.raw).not.toBe(b.raw);
  });
});
