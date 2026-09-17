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
          id: {
            type: 'string',
            description: 'short kebab-case slug, unique within this list, e.g. "node-fundamentals" or "sql-joins"',
          },
          title: { type: 'string' },
          description: { type: 'string', description: '1-3 sentences on what this topic covers and why it matters' },
          category: {
            type: 'string',
            description: 'short grouping label, e.g. "Fundamentals", "Databases", "System Design", "DevOps"',
          },
          complexityTier: { type: 'string', enum: ['beginner', 'intermediate', 'advanced'] },
          importance: {
            type: 'string',
            enum: ['core', 'important', 'nice-to-have'],
            description: 'how essential this is specifically for the stated target role',
          },
          prerequisiteIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'ids of OTHER nodes in this same list that should be learned first; empty array if this has no prerequisites within the list',
          },
          resources: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                title: { type: 'string' },
                type: { type: 'string', enum: ['article', 'video', 'course', 'official-docs', 'book'] },
                description: { type: 'string' },
              },
              required: ['title', 'type', 'description'],
            },
            description: 'Do NOT include URLs - suggest resource titles/topics only, never a specific link, since generated links are frequently wrong or dead.',
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
          'resources',
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
- Give it a genuine prerequisite structure using prerequisiteIds referencing other node ids in this same list - foundational topics should have no prerequisites, and topics that build on others should reference them. Do not create circular dependencies.
- Assign complexityTier honestly based on how advanced the topic actually is, not based on where it falls in the learning order.
- Assign importance based specifically on how essential this is for THIS role - not every topic is "core".
- Suggest resources by title/type/description only - never include a URL, since AI-generated links are frequently wrong or dead and this would mislead the candidate.
- Suggest 1-2 practical project ideas per node where relevant, that would demonstrably prove the skill.

Aim for a reasonably complete but not overwhelming roadmap - typically 8-20 nodes depending on how large the actual skill gap is. If the candidate's current skills already cover most of what this role needs, say so honestly in overallSummary and propose fewer, more targeted nodes rather than padding the list.

Respond strictly following the response schema.`;
}
