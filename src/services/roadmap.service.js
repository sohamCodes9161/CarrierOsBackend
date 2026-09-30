import { Roadmap } from '../models/Roadmap.model.js';
import { CareerProfile } from '../models/CareerProfile.model.js';
import { generateStructuredContent } from '../integrations/groq.integration.js';
import {
  buildRoadmapPrompt,
  roadmapNodesSchema,
  roadmapNodesSchemaName,
} from '../integrations/prompts/roadmap.prompt.js';
import { computeSkillGap, filterNodesAgainstKnownSkills } from '../utils/skillGapAnalyzer.js';
import { buildRoadmapGraph } from '../utils/roadmapGraph.js';
import { BadRequestError, NotFoundError, ForbiddenError } from '../errors/AppError.js';

function normalizeRoleKey(role) {
  return role.trim().toLowerCase().replace(/\s+/g, ' ');
}
// backend/src/services/roadmap.service.js

function sanitizeResourceUrl(resource, fallbackQuery) {
  const url = resource?.url?.trim();
  // Check if URL exists and is a valid HTTPS string
  if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
    return url;
  }
  // Fallback to a functional search query URL if model leaves URL blank or broken
  const query = encodeURIComponent(`${resource.title || fallbackQuery} tutorial`);
  return `https://www.google.com/search?q=${query}`;
}

export async function generateRoadmap({ userId, targetRole, targetSkills }) {
  const profile = await CareerProfile.findOne({ user: userId });
  if (!profile) {
    throw new BadRequestError('Generate a career profile first before requesting a roadmap.');
  }

  const skillGap = computeSkillGap({ targetSkills, profileSkills: profile.skills });

  const prompt = buildRoadmapPrompt({
    targetRole,
    targetSkills,
    profileSkills: profile.skills,
    profileStrengths: profile.strengths,
    profileGrowthAreas: profile.growthAreas,
  });

  const aiResult = await generateStructuredContent({
    prompt,
    responseSchema: roadmapNodesSchema,
    schemaName: roadmapNodesSchemaName,
    temperature: 0.3, // Lower temperature slightly for higher structural fidelity
  });

  const filteredNodes = filterNodesAgainstKnownSkills(aiResult.nodes, profile.skills);

  // Fallback sanitizer to ensure every resource & practice item has a functional URL
  const sanitizedNodes = filteredNodes.map((node) => ({
    ...node,
    resources: (node.resources || []).map((res) => ({
      ...res,
      url: sanitizeResourceUrl(res, node.title),
      isFree: typeof res.isFree === 'boolean' ? res.isFree : true,
    })),
    practice: (node.practice || []).map((prac) => ({
      ...prac,
      url: sanitizeResourceUrl(prac, node.title),
      isFree: typeof prac.isFree === 'boolean' ? prac.isFree : true,
    })),
  }));

  const { nodes, milestones, totalEstimatedDurationDays } = buildRoadmapGraph(sanitizedNodes);

  const roadmap = await Roadmap.findOneAndUpdate(
    { user: userId, targetRoleKey: normalizeRoleKey(targetRole) },
    {
      user: userId,
      targetRole,
      targetRoleKey: normalizeRoleKey(targetRole),
      targetSkillsRequested: targetSkills,
      skillGap,
      careerProfileId: profile._id,
      overallSummary: aiResult.overallSummary,
      totalEstimatedDurationDays,
      nodes,
      milestones,
      generatedAt: new Date(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return roadmap;
}