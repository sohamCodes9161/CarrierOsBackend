import { describe, it, expect } from '@jest/globals';
import { generateRoadmapSchema, updateNodeStatusSchema } from '../src/validators/roadmap.validator.js';

describe('generateRoadmapSchema', () => {
  it('accepts a valid payload with defaults applied', () => {
    const result = generateRoadmapSchema.safeParse({ targetRole: 'Backend Engineer' });
    expect(result.success).toBe(true);
    expect(result.data.targetSkills).toEqual([]);
  });

  it('accepts arbitrary role domains (frontend, python, dsa-flavored, etc.)', () => {
    for (const targetRole of ['Frontend Engineer', 'Python Developer', 'DSA-focused SWE role']) {
      expect(generateRoadmapSchema.safeParse({ targetRole }).success).toBe(true);
    }
  });

  it('rejects a role that is too short', () => {
    expect(generateRoadmapSchema.safeParse({ targetRole: 'X' }).success).toBe(false);
  });

  it('accepts an explicit targetSkills list', () => {
    const result = generateRoadmapSchema.safeParse({ targetRole: 'Backend Engineer', targetSkills: ['Docker', 'Kubernetes'] });
    expect(result.success).toBe(true);
    expect(result.data.targetSkills).toEqual(['Docker', 'Kubernetes']);
  });

  it('rejects more than 30 target skills', () => {
    const targetSkills = Array.from({ length: 31 }, (_, i) => `Skill ${i}`);
    expect(generateRoadmapSchema.safeParse({ targetRole: 'Backend Engineer', targetSkills }).success).toBe(false);
  });
});

describe('updateNodeStatusSchema', () => {
  it('accepts each valid status value', () => {
    for (const status of ['not_started', 'in_progress', 'completed', 'skipped']) {
      expect(updateNodeStatusSchema.safeParse({ status }).success).toBe(true);
    }
  });

  it('rejects an invalid status value', () => {
    expect(updateNodeStatusSchema.safeParse({ status: 'done' }).success).toBe(false);
  });
});
