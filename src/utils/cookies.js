import { env } from '../config/env.js';

const REFRESH_COOKIE_NAME = 'refreshToken';

export function trsetRefreshTokenCookie(res, rawToken, expiresAt) {
  res.cookie(REFRESH_COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure:true, // requires HTTPS in prod (Render gives you this)
    sameSite: 'none', // 'none' needed cross-site (Vercel <-> Render)
    expires: expiresAt,
    path: '/api/v1/auth', // only sent to auth routes, not every request
  });
}

export function clearRefreshTokenCookie(res) {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/api/v1/auth',
  });
}

export { REFRESH_COOKIE_NAME };
