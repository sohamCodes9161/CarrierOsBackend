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
    temperature: 0.5, // Added temperature for better resource sourcing and checklist variety
  });

  const filteredNodes = filterNodesAgainstKnownSkills(aiResult.nodes, profile.skills);

  const { nodes, milestones, totalEstimatedDurationDays } = buildRoadmapGraph(filteredNodes);

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

export async function listRoadmaps(userId) {
  return Roadmap.find({ user: userId })
    .sort({ updatedAt: -1 })
    .select('targetRole totalEstimatedDurationDays generatedAt createdAt updatedAt');
}

export async function getRoadmapById({ roadmapId, userId }) {
  const roadmap = await Roadmap.findById(roadmapId);
  if (!roadmap) {
    throw new NotFoundError('Roadmap not found');
  }
  if (roadmap.user.toString() !== userId) {
    throw new ForbiddenError('You do not have access to this roadmap');
  }
  return roadmap;
}

export async function updateNodeStatus({ roadmapId, userId, nodeId, status }) {
  const roadmap = await Roadmap.findById(roadmapId);
  if (!roadmap) {
    throw new NotFoundError('Roadmap not found');
  }
  if (roadmap.user.toString() !== userId) {
    throw new ForbiddenError('You do not have access to this roadmap');
  }

  const node = roadmap.nodes.find((n) => n.id === nodeId);
  if (!node) {
    throw new NotFoundError(`No node with id "${nodeId}" exists on this roadmap`);
  }

  const updated = await Roadmap.findOneAndUpdate(
    { _id: roadmapId, 'nodes.id': nodeId },
    { $set: { 'nodes.$.status': status } },
    { new: true }
  );

  return updated;
}