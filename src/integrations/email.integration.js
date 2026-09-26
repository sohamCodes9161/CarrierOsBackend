import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

let transporter = null;

function getTransporter() {
  if (!env.SMTP_HOST) return null; // not configured - dev mode
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

/**
 * Sends a password reset email. If SMTP isn't configured (no SMTP_HOST env
 * var), logs the reset link to the console instead - the reset flow is
 * fully testable with zero email provider setup. Works with any SMTP
 * provider (Brevo, Mailtrap for dev/sandbox testing, Gmail SMTP, Resend's
 * SMTP endpoint, etc.) since it isn't locked to one vendor's SDK.
 *
 * Never throws: a failed or unavailable send should never surface as an
 * error to the caller, since the forgot-password flow always returns the
 * same generic response regardless of whether the email exists or the
 * send actually succeeded.
 */
export async function sendPasswordResetEmail(toEmail, resetLink) {
  const transport = getTransporter();

  if (!transport) {
    console.log(`[email:dev-mode] Password reset link for ${toEmail}: ${resetLink}`);
    return;
  }

  try {
    await transport.sendMail({
      from: env.SMTP_FROM,
      to: toEmail,
      subject: 'Reset your CareerOS password',
      text: `We received a request to reset your password. Use the link below to choose a new one:\n\n${resetLink}\n\nThis link expires in ${env.PASSWORD_RESET_TOKEN_EXPIRES_IN_MINUTES} minutes. If you didn't request this, you can safely ignore this email.`,
      html: `<p>We received a request to reset your password.</p><p><a href="${resetLink}">Click here to choose a new password</a></p><p>This link expires in ${env.PASSWORD_RESET_TOKEN_EXPIRES_IN_MINUTES} minutes. If you didn't request this, you can safely ignore this email.</p>`,
    });
  } catch (err) {
    console.error('[email] Failed to send password reset email:', err.message);
  }
}
