// --- 1. GATEKEEPER VALIDATION ---
export const resumeValidationSchemaName = 'resume_validation';

export const resumeValidationSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    isValidResume: { 
      type: 'boolean', 
      description: 'True if the extracted text appears to be a legitimate resume or CV.' 
    },
    reason: { 
      type: 'string',
      description: 'Short explanation of why it is valid or invalid.'
    }
  },
  required: ['isValidResume', 'reason'],
};

export function buildResumeValidationPrompt(resumeText) {
  // Only send the first chunk of text to quickly verify if it's a resume
  const textChunk = resumeText.substring(0, 1500);
  return `You are a document validator. Check if the following text extracted from a file is a valid resume or CV.
  
If the text is gibberish, an error message, completely blank, or entirely unrelated to a person's professional/academic background, set isValidResume to false.
If it looks like a standard resume (contains name, education, skills, experience, projects, etc.), set isValidResume to true.

EXTRACTED TEXT:
"""
${textChunk}
"""`;
}

// --- 2. MAIN ANALYSIS ---
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
Be specific and honest - do not inflate scores unnecessarily, but evaluate fairly. Base every claim strictly on the resume text given; do not invent experience, companies, or skills that are not present.

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