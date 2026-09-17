import { describe, it, expect } from '@jest/globals';
import { buildResumeAnalysisPrompt, resumeAnalysisSchema } from '../src/integrations/prompts/resumeAnalysis.prompt.js';

describe('buildResumeAnalysisPrompt', () => {
  it('includes the resume text', () => {
    const prompt = buildResumeAnalysisPrompt({ resumeText: 'UNIQUE_RESUME_MARKER', jobDescription: null });
    expect(prompt).toContain('UNIQUE_RESUME_MARKER');
  });

  it('includes the job description when provided', () => {
    const prompt = buildResumeAnalysisPrompt({
      resumeText: 'resume text',
      jobDescription: 'UNIQUE_JD_MARKER',
    });
    expect(prompt).toContain('UNIQUE_JD_MARKER');
  });

  it('instructs the model to set jobMatchScore to -1 when no job description is given', () => {
    const prompt = buildResumeAnalysisPrompt({ resumeText: 'resume text', jobDescription: null });
    expect(prompt).toContain('jobMatchScore to -1');
  });
});

describe('resumeAnalysisSchema', () => {
  it('requires all top-level fields the service depends on', () => {
    expect(resumeAnalysisSchema.required).toEqual(
      expect.arrayContaining([
        'atsScore',
        'jobMatchScore',
        'summary',
        'strengths',
        'weaknesses',
        'missingKeywords',
        'extractedSkills',
        'sectionFeedback',
        'suggestedBulletImprovements',
      ])
    );
  });
});
