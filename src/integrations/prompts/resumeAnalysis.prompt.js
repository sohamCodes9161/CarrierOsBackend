export const resumeAnalysisSchemaName = 'resume_analysis';

export const resumeAnalysisSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    atsScore: {
      type: 'integer',
      description: 'Overall ATS-compatibility score from 0-100',
    },
    jobMatchScore: {
      type: 'integer',
      description: '0-100 match against the job description, or -1 if no job description was provided',
    },
    summary: {
      type: 'string',
      description: 'A 2-3 sentence overall assessment',
    },
    strengths: {
      type: 'array',
      items: { type: 'string' },
    },
    weaknesses: {
      type: 'array',
      items: { type: 'string' },
    },
    missingKeywords: {
      type: 'array',
      items: { type: 'string' },
      description: 'Important keywords from the job description missing in the resume; empty if no job description given',
    },
    extractedSkills: {
      type: 'array',
      items: { type: 'string' },
      description: 'Technical and soft skills identified in the resume',
    },
    sectionFeedback: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          section: { type: 'string' },
          feedback: { type: 'string' },
        },
        required: ['section', 'feedback'],
      },
    },
    suggestedBulletImprovements: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          original: { type: 'string' },
          improved: { type: 'string' },
          reason: { type: 'string' },
        },
        required: ['original', 'improved', 'reason'],
      },
      description: 'Up to 5 weak resume bullet points rewritten to be stronger',
    },
  },
  required: [
    'atsScore',
    'jobMatchScore',
    'summary',
    'strengths',
    'weaknesses',
    'missingKeywords',
    'extractedSkills',
    'sectionFeedback',
    'suggestedBulletImprovements',
  ],
};

export function buildResumeAnalysisPrompt({ resumeText, jobDescription }) {
  return `You are an expert technical recruiter and ATS (Applicant Tracking System) specialist.

Analyze the following resume${jobDescription ? ' against the provided job description' : ''}.
Be specific and honest - do not inflate scores. Base every claim strictly on the resume text given; do not invent experience, companies, or skills that are not present.

RESUME TEXT:
"""
${resumeText}
"""

${
  jobDescription
    ? `JOB DESCRIPTION:
"""
${jobDescription}
"""`
    : 'No job description was provided - set jobMatchScore to -1 and missingKeywords to an empty array.'
}

Provide your analysis strictly following the response schema.`;
}
