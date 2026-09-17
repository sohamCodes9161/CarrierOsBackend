export const interviewQuestionSchemaName = 'interview_question';

export const interviewQuestionSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    question: { type: 'string' },
    focusArea: {
      type: 'string',
      description: 'Short label for what this question targets, e.g. "System Design", "React fundamentals", "Conflict resolution"',
    },
  },
  required: ['question', 'focusArea'],
};

export function buildInterviewQuestionPrompt({
  role,
  difficulty,
  interviewType,
  targetSkills,
  questionNumber,
  totalQuestions,
  history,
}) {
  const historyBlock =
    history.length > 0
      ? history
          .map(
            (h, i) =>
              `Q${i + 1} (${h.focusArea}): ${h.questionText}\nCandidate's answer: ${h.answerText}\nEvaluation: correctness ${h.evaluation.correctnessScore}/100, weaknesses: ${h.evaluation.weaknesses.join(', ') || 'none noted'}`
          )
          .join('\n\n')
      : 'This is the first question - no prior history.';

  const difficultyGuidance = {
    easy: 'Focus on foundational core concepts and basic syntax, but ask it conversationally - like you\'re genuinely curious how they\'d explain it to a colleague, not like reciting a textbook definition.',
    medium: 'Focus on practical, scenario-based problem solving: real-world trade-offs and architecture/design decisions (e.g. handling scale, connection pooling, caching strategy, when to denormalize).',
    hard: 'Focus on edge cases, high-concurrency conflicts, internal engine mechanisms, system failure modes, and deep performance optimization - the kind of question that separates someone who has used a tool from someone who understands how it actually works under the hood.',
  }[difficulty];

  const interviewTypeNote =
    interviewType === 'dsa'
      ? '\nThis is a DSA (Data Structures & Algorithms) interview, and it is voice-based - the candidate is speaking their answer aloud, not writing code. Pose a problem and ask them to talk through their approach: which data structure they\'d choose and why, the algorithm at a conceptual/step level, and the resulting time/space complexity. Do not ask them to "write" or "type" code; ask them to describe or walk through it verbally.'
      : '';

  return `You are conducting a ${interviewType} interview for a ${role} position at ${difficulty} difficulty.
Target skills to probe: ${targetSkills.length > 0 ? targetSkills.join(', ') : 'general role-relevant skills'}.

DIFFICULTY-SPECIFIC GUIDANCE FOR THIS QUESTION: ${difficultyGuidance}${interviewTypeNote}

This is question ${questionNumber} of ${totalQuestions}.

PRIOR QUESTIONS AND ANSWERS IN THIS INTERVIEW:
${historyBlock}

Generate the next interview question following the difficulty-specific guidance above. If prior answers revealed weaknesses or missing concepts, prefer probing those areas next rather than repeating well-covered ground. The question should read clearly and be well-structured on screen, but phrased so it also sounds natural when read aloud by a text-to-speech voice - avoid heavy code blocks or symbols that don't translate to speech; describe code concepts in words. Do not repeat a question already asked above.

Respond strictly following the response schema.`;
}
