import { describe, it, expect } from '@jest/globals';
import { githubAnalyzeSchema } from '../src/validators/github.validator.js';

describe('githubAnalyzeSchema', () => {
  it('accepts a valid username', () => {
    expect(githubAnalyzeSchema.safeParse({ username: 'torvalds' }).success).toBe(true);
  });

  it('accepts a username with hyphens', () => {
    expect(githubAnalyzeSchema.safeParse({ username: 'jane-doe-99' }).success).toBe(true);
  });

  it('rejects a username with a leading hyphen', () => {
    expect(githubAnalyzeSchema.safeParse({ username: '-janedoe' }).success).toBe(false);
  });

  it('rejects a username with consecutive hyphens', () => {
    expect(githubAnalyzeSchema.safeParse({ username: 'jane--doe' }).success).toBe(false);
  });

  it('rejects a username with invalid characters', () => {
    expect(githubAnalyzeSchema.safeParse({ username: 'jane_doe!' }).success).toBe(false);
  });

  it('rejects an empty username', () => {
    expect(githubAnalyzeSchema.safeParse({ username: '' }).success).toBe(false);
  });

  it('rejects a username over 39 characters', () => {
    expect(githubAnalyzeSchema.safeParse({ username: 'a'.repeat(40) }).success).toBe(false);
  });
});
