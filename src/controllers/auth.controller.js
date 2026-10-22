import * as authService from '../services/auth.service.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { setRefreshTokenCookie, clearRefreshTokenCookie, REFRESH_COOKIE_NAME } from '../utils/cookies.js';

export const register = asyncHandler(async (req, res) => {
  const { user, accessToken, refreshToken, refreshTokenExpiresAt } = await authService.registerUser(req.body);
  setRefreshTokenCookie(res, refreshToken, refreshTokenExpiresAt);
  sendSuccess(res, { statusCode: 201, message: 'Account created successfully', data: { user, accessToken } });
});

export const login = asyncHandler(async (req, res) => {
  const { user, accessToken, refreshToken, refreshTokenExpiresAt } = await authService.loginUser(req.body);
  setRefreshTokenCookie(res, refreshToken, refreshTokenExpiresAt);
  sendSuccess(res, { message: 'Logged in successfully', data: { user, accessToken } });
});

export const refresh = asyncHandler(async (req, res) => {
  const rawRefreshToken = req.cookies[REFRESH_COOKIE_NAME];
  const { accessToken, refreshToken, refreshTokenExpiresAt } = await authService.refreshSession(rawRefreshToken);
  setRefreshTokenCookie(res, refreshToken, refreshTokenExpiresAt);
  sendSuccess(res, { message: 'Token refreshed', data: { accessToken } });
});

export const logout = asyncHandler(async (req, res) => {
  const rawRefreshToken = req.cookies[REFRESH_COOKIE_NAME];
  await authService.logoutUser(rawRefreshToken);
  clearRefreshTokenCookie(res);
  sendSuccess(res, { message: 'Logged out successfully' });
});

export const getMe = asyncHandler(async (req, res) => {
  const user = await authService.getUserById(req.userId);
  sendSuccess(res, { data: { user } });
});

// NEW: Password Management Controllers
export const requestPasswordReset = asyncHandler(async (req, res) => {
  await authService.requestPasswordReset(req.body.email);
  sendSuccess(res, { message: 'If an account with that email exists, a reset link has been sent.' });
});

export const resetPassword = asyncHandler(async (req, res) => {
  await authService.resetPassword(req.body);
  sendSuccess(res, { message: 'Password reset successfully. You can now log in.' });
});

export const changePassword = asyncHandler(async (req, res) => {
  await authService.changePassword({ userId: req.userId, ...req.body });
  sendSuccess(res, { message: 'Password changed successfully.' });
});