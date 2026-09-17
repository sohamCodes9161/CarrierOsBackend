export const githubAnalysisSchemaName = 'github_analysis';

export const githubAnalysisSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    summary: {
      type: 'string',
      description: 'A 2-4 sentence overall assessment of this developer profile',
    },
    estimatedSkillLevel: {
      type: 'string',
      enum: ['beginner', 'intermediate', 'advanced'],
    },
    strengths: { type: 'array', items: { type: 'string' } },
    areasForImprovement: { type: 'array', items: { type: 'string' } },
    inferredSkills: {
      type: 'array',
      items: { type: 'string' },
      description: 'Technologies/skills inferred from languages, repo topics, and READMEs',
    },
    projectHighlights: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          repoName: { type: 'string' },
          whyItStandsOut: { type: 'string' },
        },
        required: ['repoName', 'whyItStandsOut'],
      },
    },
    activityAssessment: {
      type: 'string',
      description: 'Brief note on consistency/recency of contribution activity',
    },
  },
  required: [
    'summary',
    'estimatedSkillLevel',
    'strengths',
    'areasForImprovement',
    'inferredSkills',
    'projectHighlights',
    'activityAssessment',
  ],
};

export function buildGithubAnalysisPrompt({ stats, commitActivity, repoHealth, readmeExcerpts }) {
  return `You are a senior technical recruiter evaluating a developer's GitHub profile for a career platform.

Base every claim strictly on the data given below. Do not invent projects, skills, or achievements not evidenced in this data.

PROFILE STATS (JSON):
${JSON.stringify(stats, null, 2)}

RECENT COMMIT ACTIVITY (last ~90 days, from public events):
${JSON.stringify(commitActivity, null, 2)}

REPO QUALITY/PROCESS CHECKLIST (presence of README/LICENSE/tests/CI/etc. - use this to ground your quality assessment, not just README prose):
${JSON.stringify(repoHealth, null, 2)}

README EXCERPTS FROM TOP REPOSITORIES:
${readmeExcerpts.length > 0 ? readmeExcerpts.map((r) => `--- ${r.repoName} ---\n${r.excerpt}`).join('\n\n') : 'No README content available.'}

Provide your analysis strictly following the response schema. Be honest and specific - a sparse or inactive profile should be described as such, not inflated. Use the commit activity and repo health checklist as concrete evidence for your strengths/areasForImprovement, not just impressions from README text.`;
}
