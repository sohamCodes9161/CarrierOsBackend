import { env } from '../config/env.js';

const REFRESH_COOKIE_NAME = 'refreshToken';

export function setRefreshTokenCookie(res, rawToken, expiresAt) {
  res.cookie(REFRESH_COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: true,      // Required for HTTPS cross-site in production
    sameSite: 'none',  // Required because Vercel and Render are different domains
    expires: expiresAt,
    // Removed explicit path restriction so it is sent reliably on all proxy routes
  });
}

export function clearRefreshTokenCookie(res) {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
  });
}

export { REFRESH_COOKIE_NAME };