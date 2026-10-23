import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.model.js';
import { RefreshToken } from '../models/RefreshToken.model.js';
import { PasswordResetToken } from '../models/PasswordResetToken.model.js';
import { env } from '../config/env.js';
import { signAccessToken, generateRefreshToken, hashRefreshToken } from '../utils/token.js';
import { ConflictError, UnauthorizedError, BadRequestError } from '../errors/AppError.js';
import { sendPasswordResetEmail, sendVerificationEmail } from '../integrations/email.integration.js';


const SALT_ROUNDS = 10;

async function issueTokenPair(userId) {
  const accessToken = signAccessToken(userId);
  const { raw, hash, expiresAt } = generateRefreshToken();

  await RefreshToken.create({ user: userId, tokenHash: hash, expiresAt });

  return { accessToken, refreshToken: raw, refreshTokenExpiresAt: expiresAt };
}

export async function registerUser({ name, email, password }) {
  const existingUser = await User.findOne({ email });

  if (existingUser) {
    if (existingUser.isEmailVerified) {
      throw new ConflictError('An account with this email already exists');
    }
    // If unverified, we will overwrite their OTP and resend it
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  
  // Generate a fresh 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

  if (existingUser) {
    // FIX: Use updateOne instead of .save() to guarantee hidden fields are overwritten
    await User.updateOne(
      { _id: existingUser._id },
      { 
        $set: { 
          name, 
          passwordHash, 
          verificationOtp: otp, 
          verificationOtpExpiresAt: expiresAt 
        } 
      }
    );
  } else {
    await User.create({ 
      name, 
      email, 
      passwordHash, 
      isEmailVerified: false,
      verificationOtp: otp,
      verificationOtpExpiresAt: expiresAt
    });
  }

  await sendVerificationEmail(email, otp);
  return { requiresVerification: true, email };
}

export async function verifyRegistrationOtp({ email, otp }) {
  const user = await User.findOne({ email }).select('+verificationOtp +verificationOtpExpiresAt');
  
  if (!user || user.isEmailVerified) {
    throw new BadRequestError('User not found or already verified');
  }

  // Debugging log: See exactly what the database is expecting vs what you typed
  console.log(`[OTP Check] DB Expects: "${user.verificationOtp}" | User Entered: "${otp}"`);

  if (user.verificationOtp !== otp || user.verificationOtpExpiresAt < new Date()) {
    throw new BadRequestError('Invalid or expired verification code');
  }

  // Mark as verified and clean up OTP
  user.isEmailVerified = true;
  user.verificationOtp = undefined;
  user.verificationOtpExpiresAt = undefined;
  await user.save();

  // Issue tokens only AFTER successful verification
  const tokens = await issueTokenPair(user._id);
  return { user, ...tokens };
}

export async function loginUser({ email, password }) {
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user) {
    throw new UnauthorizedError('Invalid email or password');
  }
  if (!user.isEmailVerified) {
    throw new UnauthorizedError('Please verify your email before logging in');
  }
  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    throw new UnauthorizedError('Invalid email or password');
  }



  const tokens = await issueTokenPair(user._id);
  return { user, ...tokens };
}
// src/services/auth.service.js

export async function refreshSession(rawRefreshToken) {
  if (!rawRefreshToken) {
    throw new UnauthorizedError('No refresh token provided');
  }

  const tokenHash = hashRefreshToken(rawRefreshToken);
  const stored = await RefreshToken.findOne({ tokenHash });

  if (!stored || stored.expiresAt < new Date()) {
    throw new UnauthorizedError('Refresh token is invalid or expired');
  }

  // FIX: Remove `await RefreshToken.deleteOne({ _id: stored._id });`
  // Instead of deleting and rotating the refresh token on every single reload,
  // we reuse the valid refresh token and only issue a fresh Access Token.
  // This completely eliminates the hot-reload / network race condition bug.
  const accessToken = signAccessToken(stored.user);

  return { 
    accessToken, 
    refreshToken: rawRefreshToken, // Keep the same refresh token
    refreshTokenExpiresAt: stored.expiresAt 
  };
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

/**
 * Initiates a password reset process by generating a token and sending a reset email.
 * Quietly returns if the email is not registered (for security).
 */
export async function requestPasswordReset(email) {
  const user = await User.findOne({ email });
  if (!user) return; // Silent success to prevent account enumeration

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins expiry

  await PasswordResetToken.create({
    user: user._id,
    tokenHash,
    expiresAt,
  });

  const resetUrl = `${env.RESET_PASSWORD_URL}?token=${rawToken}`;
  await sendPasswordResetEmail(user.email, resetUrl);
}

/**
 * Resets the password using a valid, non-expired reset token.
 */
export async function resetPassword({ token, newPassword }) {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const storedToken = await PasswordResetToken.findOne({ tokenHash });

  if (!storedToken || storedToken.expiresAt < new Date()) {
    throw new BadRequestError('Reset token is invalid or has expired');
  }

  const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  // 1. Update user's password
  await User.updateOne({ _id: storedToken.user }, { $set: { passwordHash: newPasswordHash } });

  // 2. Invalidate reset token (single-use)
  await PasswordResetToken.deleteOne({ _id: storedToken._id });

  // 3. Invalidate all active refresh sessions for security
  await RefreshToken.deleteMany({ user: storedToken.user });
}

/**
 * Changes password for an authenticated user after verifying current password.
 */
export async function changePassword({ userId, currentPassword, newPassword }) {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) {
    throw new UnauthorizedError('User no longer exists');
  }

  const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isMatch) {
    throw new UnauthorizedError('Current password is incorrect');
  }

  const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  // Update password and invalidate all active sessions
  await User.updateOne({ _id: userId }, { $set: { passwordHash: newPasswordHash } });
  await RefreshToken.deleteMany({ user: userId });
}