import { env } from '../config/env.js';

export async function sendPasswordResetEmail(toEmail, resetLink) {
  // Fallback for local testing if no API key is provided
  if (!env.BREVO_API_KEY) {
    console.log(`[email:dev-mode] Password reset link for ${toEmail}: ${resetLink}`);
    return;
  }

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': env.BREVO_API_KEY,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        sender: { email: "carrieros001@gmail.com", name: "CareerOS" },
        to: [{ email: toEmail }],
        subject: 'Reset your CareerOS password',
        htmlContent: `
          <p>We received a request to reset your password.</p>
          <p><a href="${resetLink}">Click here to choose a new password</a></p>
          <p>This link expires in ${env.PASSWORD_RESET_TOKEN_EXPIRES_IN_MINUTES} minutes. If you didn't request this, you can safely ignore this email.</p>
        `
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[email] Brevo API rejected the request:', errorData);
    } else {
      console.log(`[email] Password reset sent successfully to ${toEmail}`);
    }
  } catch (err) {
    console.error('[email] Failed to send password reset email:', err.message);
  }
}