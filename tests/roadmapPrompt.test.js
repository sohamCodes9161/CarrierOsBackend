import { describe, it, expect } from '@jest/globals';
import { buildRoadmapPrompt } from '../src/integrations/prompts/roadmap.prompt.js';

const baseArgs = {
  targetRole: 'Backend Engineer',
  targetSkills: [],
  profileSkills: [{ name: 'Node.js', sources: ['resume'] }],
  profileStrengths: ['UNIQUE_STRENGTH'],
  profileGrowthAreas: ['UNIQUE_GROWTH_AREA'],
};

describe('buildRoadmapPrompt', () => {
  it('includes the target role', () => {
    const prompt = buildRoadmapPrompt(baseArgs);
    expect(prompt).toContain('Backend Engineer');
  });

  it('includes known skills so the AI avoids repeating them', () => {
    const prompt = buildRoadmapPrompt(baseArgs);
    expect(prompt).toContain('Node.js');
    expect(prompt.toLowerCase()).toContain('do not propose roadmap topics for things they already know');
  });

  it('includes explicit target skills when provided', () => {
    const prompt = buildRoadmapPrompt({ ...baseArgs, targetSkills: ['UNIQUE_TARGET_SKILL'] });
    expect(prompt).toContain('UNIQUE_TARGET_SKILL');
  });

  it('tells the model to infer requirements when no explicit skills are given', () => {
    const prompt = buildRoadmapPrompt({ ...baseArgs, targetSkills: [] });
    expect(prompt).toContain('No explicit skill list was given');
  });

  it('instructs the model never to include resource URLs', () => {
    const prompt = buildRoadmapPrompt(baseArgs);
    expect(prompt.toLowerCase()).toContain('never include a url');
  });

  it('instructs the model not to create circular dependencies', () => {
    const prompt = buildRoadmapPrompt(baseArgs);
    expect(prompt.toLowerCase()).toContain('circular');
  });

  it('includes strengths and growth areas', () => {
    const prompt = buildRoadmapPrompt(baseArgs);
    expect(prompt).toContain('UNIQUE_STRENGTH');
    expect(prompt).toContain('UNIQUE_GROWTH_AREA');
  });
});
