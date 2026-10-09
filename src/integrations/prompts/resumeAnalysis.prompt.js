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
  return `You are an expert technical recruiter and a highly accurate ATS (Applicant Tracking System).
Your job is to critically evaluate this resume. Do not artificially inflate scores, but be fair to entry-level candidates ("freshers"). 

=== REALISTIC ATS SCORING RUBRIC (Start at 100, deduct points exactly as follows) ===
- IMPACT & METRICS: Deduct EXACTLY 15 points if the majority of bullet points lack quantifiable scale or results (e.g., missing numbers, percentages, or user impact). 
- ACTION VERBS: Deduct EXACTLY 10 points if bullet points read like generic task lists or start with weak verbs ("Responsible for", "Worked on").
- EXPERIENCE vs PROJECTS: Deduct EXACTLY 15 points ONLY IF the resume lacks BOTH real-world professional experience AND substantial technical projects. (Do not penalize freshers if they have strong projects).
- FORMATTING & STRUCTURE: Deduct EXACTLY 10 points for missing standard sections (Summary, Education, Skills, Projects/Experience) or dense, unparseable walls of text.
- SOFT SKILLS: Deduct EXACTLY 5 points if there is zero mention of teamwork, communication, or leadership.

CRITICAL INSTRUCTION: You must calculate the atsScore strictly by subtracting the exact penalties above from 100. Do not let the presence of a matching job description influence the base atsScore.

=== FEEDBACK & IMPROVEMENTS ===
- Your 'weaknesses' and 'sectionFeedback' MUST reflect the point deductions accurately.
- For 'suggestedBulletImprovements', rewrite the weakest bullets using the XYZ formula: "Accomplished [X] as measured by [Y], by doing [Z]". Do not invent fake metrics, but use placeholders like [X]% or [number] to show the candidate where to insert their own data.

RESUME TEXT:
"""
${resumeText}
"""

${
  jobDescription
    ? `=== JOB MATCH RUBRIC ===
- Start at 100. Deduct 5-10 points for EVERY major required skill, technology, or requirement missing from the resume.
- Deduct 15 points if they severely lack the explicitly required years of experience (but account for project experience if it's a junior role).
- If the resume is completely irrelevant to the job description, the score should be below 30.

JOB DESCRIPTION:
"""
${jobDescription}
"""`
    : 'No job description was provided - set jobMatchScore to -1 and missingKeywords to an empty array.'
}

Provide your analysis strictly following the response schema.`;
}