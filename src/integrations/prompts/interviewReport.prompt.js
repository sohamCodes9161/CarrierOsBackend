export const interviewReportSchemaName = 'interview_report';

export const interviewReportSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    overallScore: { type: 'integer', description: '0-100 overall performance score' },
    summary: { type: 'string', description: '3-4 sentence overall assessment' },
    strengths: { type: 'array', items: { type: 'string' } },
    weaknesses: { type: 'array', items: { type: 'string' } },
    recommendation: {
      type: 'string',
      description: 'Concrete advice on what to study/practice next',
    },
    readyForRole: {
      type: 'boolean',
      description: 'Honest assessment of whether this performance suggests readiness for the target role',
    },
  },
  required: ['overallScore', 'summary', 'strengths', 'weaknesses', 'recommendation', 'readyForRole'],
};

export function buildInterviewReportPrompt({ role, difficulty, interviewType, history }) {
  const transcript = history
    .map(
      (h, i) =>
        `Q${i + 1} (${h.focusArea}): ${h.questionText}\nAnswer: ${h.answerText}\nScores: correctness ${h.evaluation.correctnessScore}/100, communication ${h.evaluation.communicationScore}/100\nWeaknesses noted: ${h.evaluation.weaknesses.join(', ') || 'none'}`
    )
    .join('\n\n');

  return `You are summarizing a completed ${interviewType} interview for a ${role} position at ${difficulty} difficulty into a final report.

FULL TRANSCRIPT WITH PER-QUESTION EVALUATIONS:
${transcript}

Synthesize this into an honest, holistic final report. Base the overallScore on the pattern across all answers, not just the most recent one. Be direct about whether this candidate's performance suggests readiness for the role - do not be artificially encouraging if the evidence doesn't support it.

Respond strictly following the response schema.`;
}
