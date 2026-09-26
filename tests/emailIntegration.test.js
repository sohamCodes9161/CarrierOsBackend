import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'test-id' });
const mockCreateTransport = jest.fn().mockReturnValue({ sendMail: mockSendMail });

jest.unstable_mockModule('nodemailer', () => ({
  default: { createTransport: mockCreateTransport },
}));

describe('sendPasswordResetEmail - dev mode (no SMTP_HOST configured)', () => {
  beforeEach(() => {
    jest.resetModules();
    mockSendMail.mockClear();
    mockCreateTransport.mockClear();
  });

  it('logs the reset link to the console instead of sending, and never throws', async () => {
    jest.unstable_mockModule('../src/config/env.js', () => ({
      env: { SMTP_HOST: '', PASSWORD_RESET_TOKEN_EXPIRES_IN_MINUTES: 30 },
    }));
    const { sendPasswordResetEmail } = await import('../src/integrations/email.integration.js');

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    await expect(sendPasswordResetEmail('jane@example.com', 'https://example.com/reset?token=abc')).resolves.not.toThrow();

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('jane@example.com'));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('https://example.com/reset?token=abc'));
    expect(mockSendMail).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});

describe('sendPasswordResetEmail - SMTP configured', () => {
  beforeEach(() => {
    jest.resetModules();
    mockSendMail.mockClear();
    mockCreateTransport.mockClear();
  });

  it('sends via the SMTP transport with the correct recipient and link', async () => {
    jest.unstable_mockModule('../src/config/env.js', () => ({
      env: {
        SMTP_HOST: 'smtp.example.com',
        SMTP_PORT: 587,
        SMTP_USER: 'user',
        SMTP_PASS: 'pass',
        SMTP_FROM: 'CareerOS <no-reply@careeros.app>',
        PASSWORD_RESET_TOKEN_EXPIRES_IN_MINUTES: 30,
      },
    }));
    const { sendPasswordResetEmail } = await import('../src/integrations/email.integration.js');

    await sendPasswordResetEmail('jane@example.com', 'https://example.com/reset?token=abc');

    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'jane@example.com',
        text: expect.stringContaining('https://example.com/reset?token=abc'),
      })
    );
  });

  it('never throws even if the SMTP send fails', async () => {
    jest.unstable_mockModule('../src/config/env.js', () => ({
      env: {
        SMTP_HOST: 'smtp.example.com',
        SMTP_PORT: 587,
        SMTP_USER: 'user',
        SMTP_PASS: 'pass',
        SMTP_FROM: 'CareerOS <no-reply@careeros.app>',
        PASSWORD_RESET_TOKEN_EXPIRES_IN_MINUTES: 30,
      },
    }));
    mockSendMail.mockRejectedValueOnce(new Error('SMTP connection refused'));
    const { sendPasswordResetEmail } = await import('../src/integrations/email.integration.js');

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(sendPasswordResetEmail('jane@example.com', 'link')).resolves.not.toThrow();
    consoleErrorSpy.mockRestore();
  });
});
