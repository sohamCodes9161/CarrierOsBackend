export const resumeAnalysisSchemaName = 'resume_analysis';

export const resumeAnalysisSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    atsScore: {
      type: 'integer',
      description: 'Overall ATS-compatibility score from 0-100 based strictly on the deduction rubric.',
    },
    jobMatchScore: {
      type: 'integer',
      description: '0-100 match against the job description, or -1 if no job description was provided.',
    },
    summary: {
      type: 'string',
      description: 'A 2-3 sentence overall assessment.',
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
      description: 'Important keywords from the job description missing in the resume; empty if no job description given.',
    },
    extractedSkills: {
      type: 'array',
      items: { type: 'string' },
      description: 'Technical and soft skills identified in the resume.',
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
      description: 'Up to 5 weak resume bullet points rewritten to be stronger using the XYZ formula.',
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
  return `You are an expert technical recruiter and a highly strict, unforgiving ATS (Applicant Tracking System).
Your job is to critically evaluate this resume. AI models naturally inflate scores and act overly polite—you MUST NOT do this. Act like a ruthless resume screener.

=== STRICT ATS SCORING RUBRIC (Start at 100, deduct points strictly) ===
- Deduct 15-20 points if the resume severely lacks quantifiable metrics (numbers, percentages, scale, money saved, users reached).
- Deduct 15 points if there is little to no real-world professional work experience (e.g., only short internships or academic projects).
- Deduct 10 points for weak bullet points (e.g., starting with "Responsible for", missing strong action verbs, reading like a job description instead of achievements).
- Deduct 10 points if soft skills (communication, teamwork, leadership) or business impact are entirely missing.
- Deduct 10 points for poor structure, unparseable formatting, or missing standard sections (Summary, Experience, Education, Skills).
An average entry-level resume with no metrics and only school projects should score between 40-60, NOT 80+.

=== FEEDBACK & IMPROVEMENTS ===
- Your 'weaknesses' and 'sectionFeedback' MUST reflect the point deductions (e.g., "Bullet points lack quantifiable impact metrics").
- For 'suggestedBulletImprovements', rewrite the weakest bullets using the XYZ formula: "Accomplished [X] as measured by [Y], by doing [Z]". Do not invent fake metrics, but use placeholders like [X]% or [number] to show the candidate where to insert their own data.

RESUME TEXT:
"""
${resumeText}
"""

${
  jobDescription
    ? `=== JOB MATCH RUBRIC ===
- Start at 100. Deduct 5-10 points for EVERY major required skill, technology, or requirement missing from the resume.
- Deduct 20 points if they lack the explicitly required years of experience.
- If the resume is completely irrelevant to the job description, the score should be below 30.

JOB DESCRIPTION:
"""
${jobDescription}
"""`
    : 'No job description was provided - set jobMatchScore to -1 and missingKeywords to an empty array.'
}

Provide your analysis strictly following the response schema. Do not inflate the scores.`;
}