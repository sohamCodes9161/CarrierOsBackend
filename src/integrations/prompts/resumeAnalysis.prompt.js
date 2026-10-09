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

=== REALISTIC ATS SCORING RUBRIC (Start at 100, deduct points accordingly) ===
- IMPACT & METRICS (Deduct up to 15 pts): If bullet points lack quantifiable scale or results (e.g., numbers, performance improvements, team size).
- ACTION VERBS (Deduct up to 10 pts): For weak phrasing (e.g., starting with "Responsible for", "Worked on") or reading like a generic task list instead of achievements.
- EXPERIENCE vs PROJECTS (Deduct up to 15 pts): Real-world ATS systems value projects for freshers. DO NOT penalize for lacking professional experience IF the candidate has strong, relevant academic or personal projects. Deduct points ONLY if the resume has NEITHER professional experience NOR substantial technical projects.
- FORMATTING & STRUCTURE (Deduct up to 10 pts): For poor structure, walls of text, or missing standard sections (Summary, Education, Skills, Projects/Experience).
- SOFT SKILLS & BUSINESS CONTEXT (Deduct up to 5 pts): If absolutely no collaboration, leadership, or communication skills are demonstrated.

A strong fresher resume with good projects but missing metrics should score roughly 75-85. A resume with no projects, no experience, and poor formatting should score below 60.

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