import { describe, it, expect } from '@jest/globals';
import { startInterviewSchema, submitAnswerSchema } from '../src/validators/interview.validator.js';

describe('startInterviewSchema', () => {
  it('accepts a valid payload and applies defaults', () => {
    const result = startInterviewSchema.safeParse({
      role: 'Backend Engineer',
      difficulty: 'medium',
      interviewType: 'technical',
    });
    expect(result.success).toBe(true);
    expect(result.data.totalQuestions).toBe(5); // default
    expect(result.data.targetSkills).toEqual([]); // default
  });

  it('rejects an invalid difficulty value', () => {
    const result = startInterviewSchema.safeParse({
      role: 'Backend Engineer',
      difficulty: 'impossible',
      interviewType: 'technical',
    });
    expect(result.success).toBe(false);
  });

  it('rejects totalQuestions below the minimum', () => {
    const result = startInterviewSchema.safeParse({
      role: 'Backend Engineer',
      difficulty: 'medium',
      interviewType: 'technical',
      totalQuestions: 0,
    });
    expect(result.success).toBe(false);
  });

  it('accepts totalQuestions well above the old cap, up to the new max', () => {
    const result = startInterviewSchema.safeParse({
      role: 'Backend Engineer',
      difficulty: 'medium',
      interviewType: 'technical',
      totalQuestions: 15,
    });
    expect(result.success).toBe(true);
  });

  it('rejects totalQuestions above the maximum', () => {
    const result = startInterviewSchema.safeParse({
      role: 'Backend Engineer',
      difficulty: 'medium',
      interviewType: 'technical',
      totalQuestions: 21,
    });
    expect(result.success).toBe(false);
  });

  it('accepts the dsa interview type', () => {
    const result = startInterviewSchema.safeParse({
      role: 'Backend Engineer',
      difficulty: 'medium',
      interviewType: 'dsa',
    });
    expect(result.success).toBe(true);
  });

  it('accepts an arbitrary free-text role (frontend, python, php, dsa focus, etc.)', () => {
    for (const role of ['Frontend Engineer', 'Python Developer', 'PHP Backend Developer', 'Full-Stack Node.js Developer']) {
      expect(startInterviewSchema.safeParse({ role, difficulty: 'medium', interviewType: 'technical' }).success).toBe(true);
    }
  });

  it('rejects a role that is too short', () => {
    const result = startInterviewSchema.safeParse({
      role: 'X',
      difficulty: 'medium',
      interviewType: 'technical',
    });
    expect(result.success).toBe(false);
  });
});

describe('submitAnswerSchema', () => {
  it('accepts a valid answer', () => {
    expect(submitAnswerSchema.safeParse({ answerText: 'A reasonable answer.' }).success).toBe(true);
  });

  it('rejects an empty answer', () => {
    expect(submitAnswerSchema.safeParse({ answerText: '' }).success).toBe(false);
  });

  it('rejects an answer over the max length', () => {
    expect(submitAnswerSchema.safeParse({ answerText: 'a'.repeat(5001) }).success).toBe(false);
  });
});
