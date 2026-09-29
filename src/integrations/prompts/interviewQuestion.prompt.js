export const interviewQuestionSchemaName = 'interview_question';

export const interviewQuestionSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    thoughtProcess: {
      type: 'string',
      description: 'Briefly explain your strategy for this question. Are you drilling down into the previous answer, or pivoting to a new topic from the target skills? Why?'
    },
    question: { type: 'string' },
    focusArea: {
      type: 'string',
      description: 'Short label for what this question targets, e.g. "System Design", "React fundamentals", "Conflict resolution"',
    },
  },
  required: ['thoughtProcess', 'question', 'focusArea'],
};

export function buildInterviewQuestionPrompt({
  role,
  difficulty,
  interviewType,
  targetSkills,
  remainingSkills,
  questionNumber,
  totalQuestions,
  history,
}) {
  const isFirstQuestion = history.length === 0;

  const historyBlock = !isFirstQuestion
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

  const availableSkills = remainingSkills && remainingSkills.length > 0 ? remainingSkills : targetSkills;

  const behavioralGuidance = isFirstQuestion
    ? `Since this is the first question, randomly pick ONE specific concept from the target skills (${targetSkills.join(', ')}) to start the interview. Do not always start with the most obvious or fundamental topic; vary your starting point.`
    : `You must act like a real, conversational human interviewer. Analyze the candidate's immediate last answer and the evaluation block. You have two choices for this next question:
1. DRILL DOWN (Follow-up): If the candidate mentioned a specific technology, an interesting concept, or showed a weakness in their last answer, ask a natural follow-up question specifically referencing what they just said (e.g., "You mentioned using X for that, how would you handle...").
2. PIVOT (New Topic): If their last answer was fully satisfactory or you have spent enough time on that topic, pivot to a completely new, unexplored topic to ensure broad assessment coverage. If you pivot, you MUST choose from these unexplored topics: ${availableSkills.join(', ')}.

Balance these approaches so the interview feels dynamic, adaptive, and not like a predetermined checklist. Always map out your 'thoughtProcess' first to explain why you are asking the question.`;

  return `You are conducting a ${interviewType} interview for a ${role} position at ${difficulty} difficulty.
Target skills to probe: ${targetSkills.length > 0 ? targetSkills.join(', ') : 'general role-relevant skills'}.

DIFFICULTY-SPECIFIC GUIDANCE FOR THIS QUESTION: ${difficultyGuidance}${interviewTypeNote}

This is question ${questionNumber} of ${totalQuestions}.

INTERVIEWER BEHAVIOR INSTRUCTIONS:
${behavioralGuidance}

PRIOR QUESTIONS AND ANSWERS IN THIS INTERVIEW:
${historyBlock}

Generate the next interview question following the guidance above. The question should read clearly and be well-structured on screen, but phrased so it also sounds natural when read aloud by a text-to-speech voice - avoid heavy code blocks or symbols that don't translate to speech; describe code concepts in words. Never repeat a question or concept already asked above.

Respond strictly following the response schema.`;
}