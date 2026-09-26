import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const mockUserFindOne = jest.fn();
const mockUserFindById = jest.fn();
const mockUserUpdateOne = jest.fn();
jest.unstable_mockModule('../src/models/User.model.js', () => ({
  User: {
    findOne: mockUserFindOne,
    findById: mockUserFindById,
    updateOne: mockUserUpdateOne,
  },
}));

const mockRefreshTokenDeleteMany = jest.fn();
jest.unstable_mockModule('../src/models/RefreshToken.model.js', () => ({
  RefreshToken: { deleteMany: mockRefreshTokenDeleteMany },
}));

const mockResetTokenCreate = jest.fn();
const mockResetTokenFindOne = jest.fn();
const mockResetTokenDeleteOne = jest.fn();
jest.unstable_mockModule('../src/models/PasswordResetToken.model.js', () => ({
  PasswordResetToken: {
    create: mockResetTokenCreate,
    findOne: mockResetTokenFindOne,
    deleteOne: mockResetTokenDeleteOne,
  },
}));

const mockSendPasswordResetEmail = jest.fn().mockResolvedValue(undefined);
jest.unstable_mockModule('../src/integrations/email.integration.js', () => ({
  sendPasswordResetEmail: mockSendPasswordResetEmail,
}));

jest.unstable_mockModule('../src/config/env.js', () => ({
  env: { RESET_PASSWORD_URL: 'https://app.example.com/reset-password' },
}));

const { requestPasswordReset, resetPassword, changePassword } = await import('../src/services/auth.service.js');

describe('requestPasswordReset', () => {
  beforeEach(() => jest.clearAllMocks());

  it('does nothing (no token, no email) when the account does not exist - never reveals this to the caller', async () => {
    mockUserFindOne.mockResolvedValue(null);
    await requestPasswordReset('nobody@example.com');
    expect(mockResetTokenCreate).not.toHaveBeenCalled();
    expect(mockSendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('creates a reset token and sends an email when the account exists', async () => {
    mockUserFindOne.mockResolvedValue({ _id: 'user1', email: 'jane@example.com' });
    await requestPasswordReset('jane@example.com');

    expect(mockResetTokenCreate).toHaveBeenCalledWith(
      expect.objectContaining({ user: 'user1', tokenHash: expect.any(String), expiresAt: expect.any(Date) })
    );
    expect(mockSendPasswordResetEmail).toHaveBeenCalledWith(
      'jane@example.com',
      expect.stringContaining('https://app.example.com/reset-password?token=')
    );
  });
});

describe('resetPassword', () => {
  beforeEach(() => jest.clearAllMocks());

  it('throws BadRequestError when the token does not exist', async () => {
    mockResetTokenFindOne.mockResolvedValue(null);
    await expect(resetPassword({ token: 'bogus', newPassword: 'newpassword1' })).rejects.toThrow(
      'invalid or has expired'
    );
  });

  it('throws BadRequestError when the token has expired', async () => {
    mockResetTokenFindOne.mockResolvedValue({
      _id: 'reset1',
      user: 'user1',
      expiresAt: new Date(Date.now() - 1000), // already expired
    });
    await expect(resetPassword({ token: 'expired-token', newPassword: 'newpassword1' })).rejects.toThrow(
      'invalid or has expired'
    );
  });

  it('updates the password, consumes the token, and invalidates all refresh tokens on success', async () => {
    mockResetTokenFindOne.mockResolvedValue({
      _id: 'reset1',
      user: 'user1',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    await resetPassword({ token: 'valid-token', newPassword: 'newpassword1' });

    expect(mockUserUpdateOne).toHaveBeenCalledWith({ _id: 'user1' }, { $set: { passwordHash: expect.any(String) } });
    expect(mockResetTokenDeleteOne).toHaveBeenCalledWith({ _id: 'reset1' }); // single-use
    expect(mockRefreshTokenDeleteMany).toHaveBeenCalledWith({ user: 'user1' }); // force re-login everywhere
  });
});

describe('changePassword', () => {
  beforeEach(() => jest.clearAllMocks());

  it('throws UnauthorizedError when the user no longer exists', async () => {
    mockUserFindById.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });
    await expect(
      changePassword({ userId: 'user1', currentPassword: 'old', newPassword: 'newpassword1' })
    ).rejects.toThrow('User no longer exists');
  });

  it('throws UnauthorizedError when the current password is wrong', async () => {
    const bcrypt = (await import('bcryptjs')).default;
    const realHash = await bcrypt.hash('correct-password', 4);
    mockUserFindById.mockReturnValue({ select: jest.fn().mockResolvedValue({ passwordHash: realHash }) });

    await expect(
      changePassword({ userId: 'user1', currentPassword: 'wrong-password', newPassword: 'newpassword1' })
    ).rejects.toThrow('Current password is incorrect');

    expect(mockUserUpdateOne).not.toHaveBeenCalled();
  });

  it('updates the password atomically and invalidates all refresh tokens when the current password is correct', async () => {
    const bcrypt = (await import('bcryptjs')).default;
    const realHash = await bcrypt.hash('correct-password', 4);
    mockUserFindById.mockReturnValue({ select: jest.fn().mockResolvedValue({ passwordHash: realHash }) });

    await changePassword({ userId: 'user1', currentPassword: 'correct-password', newPassword: 'newpassword1' });

    expect(mockUserUpdateOne).toHaveBeenCalledWith({ _id: 'user1' }, { $set: { passwordHash: expect.any(String) } });
    expect(mockRefreshTokenDeleteMany).toHaveBeenCalledWith({ user: 'user1' });
  });
});
