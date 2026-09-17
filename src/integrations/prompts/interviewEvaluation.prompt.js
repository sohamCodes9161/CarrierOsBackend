export const interviewEvaluationSchemaName = 'interview_evaluation';

export const interviewEvaluationSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    correctnessScore: { type: 'integer', description: '0-100, technical/factual accuracy' },
    communicationScore: { type: 'integer', description: '0-100, clarity and structure of the answer' },
    missingConcepts: { type: 'array', items: { type: 'string' } },
    strengths: { type: 'array', items: { type: 'string' } },
    weaknesses: { type: 'array', items: { type: 'string' } },
    feedback: { type: 'string', description: '2-3 sentences of direct, constructive feedback' },
  },
  required: [
    'correctnessScore',
    'communicationScore',
    'missingConcepts',
    'strengths',
    'weaknesses',
    'feedback',
  ],
};

export function buildInterviewEvaluationPrompt({ role, question, focusArea, answerText }) {
  return `You are a strict but fair technical interviewer evaluating a candidate's answer for a ${role} position.

QUESTION (focus area: ${focusArea}):
"""
${question}
"""

CANDIDATE'S ANSWER:
"""
${answerText}
"""

Evaluate this answer honestly. Do not inflate scores to be encouraging - a vague, incorrect, or incomplete answer should score low. Be specific about what concepts were missing or incorrect. If the answer is empty, off-topic, or nonsensical, score it accordingly (near 0) and note that in the feedback.

Respond strictly following the response schema.`;
}
