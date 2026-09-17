import { describe, it, expect } from '@jest/globals';
import { buildCareerProfilePrompt } from '../src/integrations/prompts/careerProfile.prompt.js';

const baseArgs = {
  skills: [{ name: 'Node.js', sources: ['resume', 'github'], mentionCount: 2 }],
  strengths: ['UNIQUE_STRENGTH_MARKER'],
  growthAreas: ['UNIQUE_WEAKNESS_MARKER'],
  resumeSummary: { atsScore: 80, jobMatchScore: 75, analyzedAt: new Date(), resumeAnalysisId: 'r1' },
  githubSummary: { estimatedSkillLevel: 'intermediate', totalStars: 10, githubUsername: 'jane', analyzedAt: new Date(), githubAnalysisId: 'g1' },
  interviewSummary: { interviewsCompleted: 2, averageScore: 75, lastInterviewAt: new Date() },
};

describe('buildCareerProfilePrompt', () => {
  it('includes the merged strengths and growth areas', () => {
    const prompt = buildCareerProfilePrompt(baseArgs);
    expect(prompt).toContain('UNIQUE_STRENGTH_MARKER');
    expect(prompt).toContain('UNIQUE_WEAKNESS_MARKER');
  });

  it('notes when the resume source is missing', () => {
    const prompt = buildCareerProfilePrompt({ ...baseArgs, resumeSummary: null });
    expect(prompt).toContain('NOT AVAILABLE - resume not yet analyzed');
  });

  it('notes when the GitHub source is missing', () => {
    const prompt = buildCareerProfilePrompt({ ...baseArgs, githubSummary: null });
    expect(prompt).toContain('NOT AVAILABLE - GitHub profile not yet analyzed');
  });

  it('warns about a partial picture when fewer than two sources are available', () => {
    const prompt = buildCareerProfilePrompt({
      ...baseArgs,
      githubSummary: null,
      interviewSummary: { interviewsCompleted: 0, averageScore: null, lastInterviewAt: null },
    });
    expect(prompt).toContain('partial picture');
  });

  it('does not warn about a partial picture when two or more sources are available', () => {
    const prompt = buildCareerProfilePrompt(baseArgs); // resume + github + interviews all present
    expect(prompt).not.toContain('partial picture');
  });

  it('instructs the model not to invent achievements', () => {
    const prompt = buildCareerProfilePrompt(baseArgs);
    expect(prompt.toLowerCase()).toContain('do not invent');
  });
});
