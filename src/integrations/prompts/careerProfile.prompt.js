export const careerProfileNarrativeSchemaName = 'career_profile_narrative';

export const careerProfileNarrativeSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    narrative: {
      type: 'string',
      description: '3-5 sentence holistic synthesis of this career profile',
    },
    overallReadinessLevel: {
      type: 'string',
      enum: ['early-stage', 'developing', 'job-ready', 'strong'],
    },
    topPriorityFocus: {
      type: 'array',
      items: { type: 'string' },
      description: '2-4 concrete things to focus on next, most important first',
    },
  },
  required: ['narrative', 'overallReadinessLevel', 'topPriorityFocus'],
};

export function buildCareerProfilePrompt({ skills, strengths, growthAreas, resumeSummary, githubSummary, interviewSummary }) {
  const availableSources = [resumeSummary && 'resume', githubSummary && 'GitHub', interviewSummary.interviewsCompleted > 0 && 'interview'].filter(Boolean).length;

  return `You are a career coach synthesizing a candidate's overall profile from multiple data sources into one holistic assessment.

Base every claim strictly on the data below. Do not invent experience, skills, or achievements not evidenced here. If a data source is missing (noted below), acknowledge the gap rather than guessing or filling it in.

DATA SOURCES AVAILABLE:
- Resume analysis: ${resumeSummary ? 'yes' : 'NOT AVAILABLE - resume not yet analyzed'}
- GitHub analysis: ${githubSummary ? 'yes' : 'NOT AVAILABLE - GitHub profile not yet analyzed'}
- Completed interviews: ${interviewSummary.interviewsCompleted}

AGGREGATED SKILLS (deterministically merged across sources, sorted by how many independent sources confirm them):
${JSON.stringify(skills, null, 2)}

STRENGTHS (merged across sources):
${strengths.length > 0 ? strengths.join(', ') : 'none recorded yet'}

GROWTH AREAS (merged across sources):
${growthAreas.length > 0 ? growthAreas.join(', ') : 'none recorded yet'}

RESUME SUMMARY: ${resumeSummary ? JSON.stringify(resumeSummary) : 'N/A'}
GITHUB SUMMARY: ${githubSummary ? JSON.stringify(githubSummary) : 'N/A'}
INTERVIEW SUMMARY: ${JSON.stringify(interviewSummary)}

Synthesize this into a holistic career narrative and readiness assessment. Be honest - do not inflate readiness if the evidence is thin. ${availableSources < 2 ? 'Only ' + availableSources + ' data source is available here - explicitly note in the narrative that this is a partial picture and that adding more data (resume, GitHub, or a mock interview) would sharpen the assessment.' : ''}

Respond strictly following the response schema.`;
}
