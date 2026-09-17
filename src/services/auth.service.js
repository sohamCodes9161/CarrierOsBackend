import bcrypt from 'bcryptjs';
import { User } from '../models/User.model.js';
import { RefreshToken } from '../models/RefreshToken.model.js';
import { signAccessToken, generateRefreshToken, hashRefreshToken } from '../utils/token.js';
import { ConflictError, UnauthorizedError } from '../errors/AppError.js';

const SALT_ROUNDS = 10;

async function issueTokenPair(userId) {
  const accessToken = signAccessToken(userId);
  const { raw, hash, expiresAt } = generateRefreshToken();

  await RefreshToken.create({ user: userId, tokenHash: hash, expiresAt });

  return { accessToken, refreshToken: raw, refreshTokenExpiresAt: expiresAt };
}

export async function registerUser({ name, email, password }) {
  const existing = await User.findOne({ email });
  if (existing) {
    throw new ConflictError('An account with this email already exists');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await User.create({ name, email, passwordHash });

  const tokens = await issueTokenPair(user._id);
  return { user, ...tokens };
}

export async function loginUser({ email, password }) {
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const tokens = await issueTokenPair(user._id);
  return { user, ...tokens };
}

export async function refreshSession(rawRefreshToken) {
  if (!rawRefreshToken) {
    throw new UnauthorizedError('No refresh token provided');
  }

  const tokenHash = hashRefreshToken(rawRefreshToken);
  const stored = await RefreshToken.findOne({ tokenHash });

  if (!stored || stored.expiresAt < new Date()) {
    throw new UnauthorizedError('Refresh token is invalid or expired');
  }

  // Rotation: delete the old one, issue a brand new pair
  await RefreshToken.deleteOne({ _id: stored._id });

  const tokens = await issueTokenPair(stored.user);
  return tokens;
}

export async function logoutUser(rawRefreshToken) {
  if (!rawRefreshToken) return; // nothing to invalidate, treat as already logged out
  const tokenHash = hashRefreshToken(rawRefreshToken);
  await RefreshToken.deleteOne({ tokenHash });
}

export async function getUserById(userId) {
  const user = await User.findById(userId);
  if (!user) {
    throw new UnauthorizedError('User no longer exists');
  }
  return user;
}
