import { Roadmap } from '../models/Roadmap.model.js';
import { CareerProfile } from '../models/CareerProfile.model.js';
import { generateStructuredContent } from '../integrations/groq.integration.js';
import { buildRoadmapPrompt, roadmapNodesSchema, roadmapNodesSchemaName } from '../integrations/prompts/roadmap.prompt.js';
import { computeSkillGap, filterNodesAgainstKnownSkills } from '../utils/skillGapAnalyzer.js';
import { buildRoadmapGraph } from '../utils/roadmapGraph.js';
import { BadRequestError, NotFoundError, ForbiddenError } from '../errors/AppError.js';
import { fetchRealVideoUrl, fetchRealArticleUrl } from '../integrations/search.integration.js';

function normalizeRoleKey(role) {
  return role.trim().toLowerCase().replace(/\s+/g, ' ');
}

// Replaces AI hallucinated URLs with real, fetched URLs
async function enrichResourceWithRealUrl(resource, nodeTitle) {
  const query = `${resource.title} ${nodeTitle}`;
  let realUrl = null;

  if (resource.type === 'video') {
    realUrl = await fetchRealVideoUrl(query);
  } else {
    realUrl = await fetchRealArticleUrl(query);
  }

  return {
    ...resource,
    url: realUrl || resource.url, // fallback to AI url if search fails
    isFree: typeof resource.isFree === 'boolean' ? resource.isFree : true,
  };
}

export async function generateRoadmap({ userId, targetRole, targetSkills }) {
  const profile = await CareerProfile.findOne({ user: userId });
  if (!profile) throw new BadRequestError('Generate a career profile first before requesting a roadmap.');

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
    temperature: 0.3,
  });

  const filteredNodes = filterNodesAgainstKnownSkills(aiResult.nodes, profile.skills);

  // Process all resources concurrently to prevent long delays
  const sanitizedNodes = await Promise.all(filteredNodes.map(async (node) => {
    const resources = await Promise.all((node.resources || []).map((res) => enrichResourceWithRealUrl(res, node.title)));
    const practice = await Promise.all((node.practice || []).map((prac) => enrichResourceWithRealUrl(prac, node.title)));
    return { ...node, resources, practice };
  }));

  const { nodes, milestones, totalEstimatedDurationDays } = buildRoadmapGraph(sanitizedNodes);

  return Roadmap.findOneAndUpdate(
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
}

export async function listRoadmaps(userId) {
  return Roadmap.find({ user: userId })
    .sort({ updatedAt: -1 })
    .select('targetRole totalEstimatedDurationDays generatedAt createdAt updatedAt');
}

export async function getRoadmapById({ roadmapId, userId }) {
  const roadmap = await Roadmap.findById(roadmapId);
  if (!roadmap) throw new NotFoundError('Roadmap not found');
  if (roadmap.user.toString() !== userId) throw new ForbiddenError('You do not have access to this roadmap');
  return roadmap;
}

export async function updateNodeStatus({ roadmapId, userId, nodeId, status }) {
  const roadmap = await Roadmap.findOneAndUpdate(
    { _id: roadmapId, user: userId, 'nodes.id': nodeId },
    { $set: { 'nodes.$.status': status } },
    { new: true }
  );
  if (!roadmap) throw new NotFoundError('Roadmap or node not found');
  return roadmap;
}

// New service function to handle custom user URLs
export async function updateNodeResources({ roadmapId, userId, nodeId, resources, practice }) {
  const roadmap = await Roadmap.findOneAndUpdate(
    { _id: roadmapId, user: userId, 'nodes.id': nodeId },
    { $set: { 'nodes.$.resources': resources, 'nodes.$.practice': practice } },
    { new: true }
  );
  if (!roadmap) throw new NotFoundError('Roadmap or node not found');
  return roadmap;
}