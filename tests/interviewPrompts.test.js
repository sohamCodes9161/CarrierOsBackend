import { describe, it, expect } from '@jest/globals';
import { buildInterviewQuestionPrompt } from '../src/integrations/prompts/interviewQuestion.prompt.js';
import { buildInterviewEvaluationPrompt } from '../src/integrations/prompts/interviewEvaluation.prompt.js';
import { buildInterviewReportPrompt } from '../src/integrations/prompts/interviewReport.prompt.js';

describe('buildInterviewQuestionPrompt', () => {
  it('indicates no history on the first question', () => {
    const prompt = buildInterviewQuestionPrompt({
      role: 'Backend Engineer',
      difficulty: 'medium',
      interviewType: 'technical',
      targetSkills: ['Node.js'],
      questionNumber: 1,
      totalQuestions: 5,
      history: [],
    });
    expect(prompt).toContain('no prior history');
  });

  it('includes prior weaknesses in the prompt so the AI can target them', () => {
    const prompt = buildInterviewQuestionPrompt({
      role: 'Backend Engineer',
      difficulty: 'medium',
      interviewType: 'technical',
      targetSkills: [],
      questionNumber: 2,
      totalQuestions: 5,
      history: [
        {
          questionText: 'What is a closure?',
          focusArea: 'JS Fundamentals',
          answerText: 'Not sure',
          evaluation: { correctnessScore: 20, weaknesses: ['UNIQUE_WEAKNESS_MARKER'] },
        },
      ],
    });
    expect(prompt).toContain('UNIQUE_WEAKNESS_MARKER');
  });

  it('includes conversational, foundational guidance for easy difficulty', () => {
    const prompt = buildInterviewQuestionPrompt({
      role: 'Backend Engineer',
      difficulty: 'easy',
      interviewType: 'technical',
      targetSkills: [],
      questionNumber: 1,
      totalQuestions: 5,
      history: [],
    });
    expect(prompt).toContain('conversationally');
    expect(prompt).toContain('foundational');
  });

  it('includes scenario/trade-off guidance for medium difficulty', () => {
    const prompt = buildInterviewQuestionPrompt({
      role: 'Backend Engineer',
      difficulty: 'medium',
      interviewType: 'technical',
      targetSkills: [],
      questionNumber: 1,
      totalQuestions: 5,
      history: [],
    });
    expect(prompt).toContain('trade-offs');
    expect(prompt).toContain('scenario-based');
  });

  it('includes edge-case/internals guidance for hard difficulty', () => {
    const prompt = buildInterviewQuestionPrompt({
      role: 'Backend Engineer',
      difficulty: 'hard',
      interviewType: 'technical',
      targetSkills: [],
      questionNumber: 1,
      totalQuestions: 5,
      history: [],
    });
    expect(prompt).toContain('edge cases');
    expect(prompt).toContain('concurrency');
  });

  it('instructs the model to phrase questions so they sound natural when spoken aloud', () => {
    const prompt = buildInterviewQuestionPrompt({
      role: 'Backend Engineer',
      difficulty: 'medium',
      interviewType: 'technical',
      targetSkills: [],
      questionNumber: 1,
      totalQuestions: 5,
      history: [],
    });
    expect(prompt.toLowerCase()).toContain('sounds natural when read aloud');
  });

  it('includes DSA-specific voice-based guidance when interviewType is dsa', () => {
    const prompt = buildInterviewQuestionPrompt({
      role: 'Software Engineer',
      difficulty: 'medium',
      interviewType: 'dsa',
      targetSkills: [],
      questionNumber: 1,
      totalQuestions: 5,
      history: [],
    });
    expect(prompt).toContain('DSA');
    expect(prompt.toLowerCase()).toContain('time/space complexity');
    expect(prompt.toLowerCase()).toContain('not writing code');
  });

  it('does not include DSA-specific guidance for non-dsa interview types', () => {
    const prompt = buildInterviewQuestionPrompt({
      role: 'Backend Engineer',
      difficulty: 'medium',
      interviewType: 'technical',
      targetSkills: [],
      questionNumber: 1,
      totalQuestions: 5,
      history: [],
    });
    expect(prompt).not.toContain('DSA (Data Structures');
  });

  it('supports arbitrary roles across different domains (frontend, python, php, etc.)', () => {
    for (const role of ['Frontend Engineer', 'Python Developer', 'PHP Developer']) {
      const prompt = buildInterviewQuestionPrompt({
        role,
        difficulty: 'medium',
        interviewType: 'technical',
        targetSkills: [],
        questionNumber: 1,
        totalQuestions: 5,
        history: [],
      });
      expect(prompt).toContain(role);
    }
  });
});

describe('buildInterviewEvaluationPrompt', () => {
  it('includes both the question and the answer', () => {
    const prompt = buildInterviewEvaluationPrompt({
      role: 'Backend Engineer',
      question: 'UNIQUE_QUESTION_MARKER',
      focusArea: 'System Design',
      answerText: 'UNIQUE_ANSWER_MARKER',
    });
    expect(prompt).toContain('UNIQUE_QUESTION_MARKER');
    expect(prompt).toContain('UNIQUE_ANSWER_MARKER');
  });
});

describe('buildInterviewReportPrompt', () => {
  it('includes the full transcript with scores', () => {
    const prompt = buildInterviewReportPrompt({
      role: 'Backend Engineer',
      difficulty: 'medium',
      interviewType: 'technical',
      history: [
        {
          questionText: 'UNIQUE_Q',
          focusArea: 'Databases',
          answerText: 'UNIQUE_A',
          evaluation: { correctnessScore: 90, communicationScore: 85, weaknesses: [] },
        },
      ],
    });
    expect(prompt).toContain('UNIQUE_Q');
    expect(prompt).toContain('UNIQUE_A');
    expect(prompt).toContain('90/100');
  });
});
