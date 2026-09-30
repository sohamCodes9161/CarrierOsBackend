export const roadmapNodesSchemaName = 'roadmap_nodes';

export const roadmapNodesSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    overallSummary: {
      type: 'string',
      description: '3-5 sentence summary of the roadmap: what it covers and why this path makes sense for the target role',
    },
    nodes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          category: { type: 'string' },
          complexityTier: { type: 'string', enum: ['beginner', 'intermediate', 'advanced'] },
          importance: { type: 'string', enum: ['core', 'important', 'nice-to-have'] },
          prerequisiteIds: {
            type: 'array',
            items: { type: 'string' },
          },
          checklist: {
            type: 'array',
            items: { type: 'string' },
            description: 'A list of 3-6 specific sub-topics, concepts, or tasks the candidate must master to complete this node.',
          },
          resources: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                title: { type: 'string' },
                type: { type: 'string', enum: ['article', 'video', 'course', 'official-docs', 'book', 'interactive'] },
                description: { type: 'string' },
                url: { type: 'string', description: 'A valid, real URL to the resource.' },
                isFree: { type: 'boolean' },
              },
              required: ['title', 'type', 'description', 'url', 'isFree'],
            },
          },
          practice: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                title: { type: 'string' },
                type: { type: 'string', enum: ['article', 'video', 'course', 'official-docs', 'book', 'interactive'] },
                description: { type: 'string' },
                url: { type: 'string', description: 'A valid URL to an interactive tutorial, playground, or repository.' },
                isFree: { type: 'boolean' },
              },
              required: ['title', 'type', 'description', 'url', 'isFree'],
            },
          },
          suggestedProjects: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                title: { type: 'string' },
                description: { type: 'string' },
              },
              required: ['title', 'description'],
            },
          },
        },
        required: [
          'id',
          'title',
          'description',
          'category',
          'complexityTier',
          'importance',
          'prerequisiteIds',
          'checklist',
          'resources',
          'practice',
          'suggestedProjects',
        ],
      },
    },
  },
  required: ['overallSummary', 'nodes'],
};

export function buildRoadmapPrompt({ targetRole, targetSkills, profileSkills, profileStrengths, profileGrowthAreas }) {
  const knownSkillsText =
    profileSkills.length > 0
      ? profileSkills.map((s) => `${s.name} (confirmed by: ${s.sources.join(', ')})`).join(', ')
      : 'none recorded yet';

  const explicitTargetsText =
    targetSkills.length > 0
      ? `The candidate specifically wants this roadmap to cover: ${targetSkills.join(', ')}.`
      : 'No explicit skill list was given - use your knowledge of what this role typically requires.';

  return `You are a career coach and curriculum designer building a personalized learning roadmap for a candidate targeting a "${targetRole}" role.

CANDIDATE'S CURRENT SKILLS (already confirmed - do NOT propose roadmap topics for things they already know):
${knownSkillsText}

CANDIDATE'S STRENGTHS: ${profileStrengths.length > 0 ? profileStrengths.join(', ') : 'none recorded yet'}
CANDIDATE'S KNOWN GROWTH AREAS: ${profileGrowthAreas.length > 0 ? profileGrowthAreas.join(', ') : 'none recorded yet'}

${explicitTargetsText}

Propose a set of roadmap topics (nodes) that would take this candidate from their current state toward being genuinely ready for a "${targetRole}" role. For each node:
- Break the topic down into a actionable "checklist" of 3-6 sub-concepts.
- Suggest 2-3 high-quality "resources". You MUST provide REAL, VALID URLs. To prevent dead links, rely exclusively on canonical sources: official documentation (e.g., MDN, React Docs, AWS Docs), Wikipedia, freeCodeCamp, GeeksforGeeks, or widely recognized YouTube channels (e.g., Traversy Media, Fireship).
- Provide 1-2 "practice" links. These should point to interactive playgrounds, LeetCode, GitHub templates, or guided tutorials.
- Mark resources accurately with "isFree" (true/false).
- Suggest 1-2 practical project ideas per node where relevant.

Aim for a reasonably complete but not overwhelming roadmap (8-20 nodes). Respond strictly following the response schema.`;
}