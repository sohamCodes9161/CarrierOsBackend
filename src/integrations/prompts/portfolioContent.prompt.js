export const portfolioContentSchemaName = 'portfolio_content_improvement';

export const portfolioContentSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    improvedText: {
      type: 'string',
      description: 'The polished version of the candidate\'s text',
    },
    changesSummary: {
      type: 'string',
      description: '1-2 sentences on what was changed and why',
    },
  },
  required: ['improvedText', 'changesSummary'],
};

const SECTION_GUIDANCE = {
  headline: 'a short professional headline (like a tagline under their name) - keep it punchy, under 150 characters, no fluff',
  bio: 'a personal bio/summary section - keep it warm but professional, focused on what they actually do and care about, not generic buzzwords',
  project: 'a project description - focus on what it does, what problem it solves, and the impact/scale where relevant, not just a tech-stack list',
  experience: 'a work experience description - lead with impact and outcomes, use concrete details where present in the original text, avoid inflating vague claims into specific-sounding ones',
  achievement: 'an achievement description - be concise and factual, let the accomplishment speak for itself without overselling',
};

export function buildPortfolioContentPrompt({ section, text }) {
  return `You are helping a candidate polish the wording of their personal portfolio website. This is ${SECTION_GUIDANCE[section] || 'a section of their portfolio'}.

ORIGINAL TEXT:
"""
${text}
"""

Improve the clarity, tone, and impact of this text. Do NOT invent facts, numbers, companies, or achievements that aren't in the original - only rephrase and sharpen what's actually there. If the original already reads well, make only light touch-ups rather than rewriting unnecessarily.

Respond strictly following the response schema.`;
}
