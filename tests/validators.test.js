import { describe, it, expect } from '@jest/globals';
import { registerSchema, loginSchema } from '../src/validators/auth.validator.js';

describe('registerSchema', () => {
  it('accepts a valid payload', () => {
    const result = registerSchema.safeParse({
      name: 'Jane Doe',
      email: 'Jane@Example.com',
      password: 'password123',
    });
    expect(result.success).toBe(true);
    expect(result.data.email).toBe('jane@example.com'); // lowercased
  });

  it('rejects a password with no number', () => {
    const result = registerSchema.safeParse({
      name: 'Jane',
      email: 'jane@example.com',
      password: 'onlyletters',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a password shorter than 8 characters', () => {
    const result = registerSchema.safeParse({
      name: 'Jane',
      email: 'jane@example.com',
      password: 'ab1',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid email', () => {
    const result = registerSchema.safeParse({
      name: 'Jane',
      email: 'not-an-email',
      password: 'password123',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a name shorter than 2 characters', () => {
    const result = registerSchema.safeParse({
      name: 'J',
      email: 'jane@example.com',
      password: 'password123',
    });
    expect(result.success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('accepts a valid payload', () => {
    const result = loginSchema.safeParse({ email: 'jane@example.com', password: 'anything' });
    expect(result.success).toBe(true);
  });

  it('rejects an empty password', () => {
    const result = loginSchema.safeParse({ email: 'jane@example.com', password: '' });
    expect(result.success).toBe(false);
  });
});
