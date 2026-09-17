import { describe, it, expect } from '@jest/globals';
import { buildGreetingText } from '../src/utils/interviewGreeting.js';

describe('buildGreetingText', () => {
  it('includes the role, difficulty, and interview type', () => {
    const text = buildGreetingText({
      role: 'Backend Engineer',
      difficulty: 'medium',
      interviewType: 'technical',
      targetSkills: [],
    });
    expect(text).toContain('Backend Engineer');
    expect(text).toContain('medium');
    expect(text).toContain('technical');
  });

  it('mentions target skills when provided', () => {
    const text = buildGreetingText({
      role: 'Backend Engineer',
      difficulty: 'medium',
      interviewType: 'technical',
      targetSkills: ['Node.js', 'MongoDB'],
    });
    expect(text).toContain('Node.js');
    expect(text).toContain('MongoDB');
  });

  it('omits the skills phrase cleanly when no skills are given', () => {
    const text = buildGreetingText({
      role: 'Backend Engineer',
      difficulty: 'medium',
      interviewType: 'technical',
      targetSkills: [],
    });
    expect(text).not.toContain('focusing on');
  });

  it('stays under a reasonable length for a spoken greeting', () => {
    const text = buildGreetingText({
      role: 'Backend Engineer',
      difficulty: 'medium',
      interviewType: 'technical',
      targetSkills: ['Node.js', 'MongoDB', 'Express', 'REST APIs'],
    });
    expect(text.length).toBeLessThan(400);
  });
});
