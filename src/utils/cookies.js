import { env } from '../config/env.js';

const REFRESH_COOKIE_NAME = 'refreshToken';

export function setRefreshTokenCookie(res, rawToken, expiresAt) {
  res.cookie(REFRESH_COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production', // requires HTTPS in prod (Render gives you this)
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax', // 'none' needed cross-site (Vercel <-> Render)
    expires: expiresAt,
    path: '/api/v1/auth', // only sent to auth routes, not every request
  });
}

export function clearRefreshTokenCookie(res) {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/api/v1/auth',
  });
}

export { REFRESH_COOKIE_NAME };
