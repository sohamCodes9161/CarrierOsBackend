import * as roadmapService from '../services/roadmap.service.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const generate = asyncHandler(async (req, res) => {
  const roadmap = await roadmapService.generateRoadmap({
    userId: req.userId,
    targetRole: req.body.targetRole,
    targetSkills: req.body.targetSkills,
  });
  sendSuccess(res, {
    statusCode: 201,
    message: 'Roadmap generated',
    data: { roadmap },
  });
});

export const list = asyncHandler(async (req, res) => {
  const roadmaps = await roadmapService.listRoadmaps(req.userId);
  sendSuccess(res, { data: { roadmaps } });
});

export const getRoadmap = asyncHandler(async (req, res) => {
  const roadmap = await roadmapService.getRoadmapById({
    roadmapId: req.params.id,
    userId: req.userId,
  });
  sendSuccess(res, { data: { roadmap } });
});

export const updateNodeStatus = asyncHandler(async (req, res) => {
  const roadmap = await roadmapService.updateNodeStatus({
    roadmapId: req.params.id,
    userId: req.userId,
    nodeId: req.params.nodeId,
    status: req.body.status,
  });
  sendSuccess(res, { message: 'Node status updated', data: { roadmap } });
});

// Add this below your existing exports
export const updateNodeResources = asyncHandler(async (req, res) => {
  const roadmap = await roadmapService.updateNodeResources({
    roadmapId: req.params.id,
    userId: req.userId,
    nodeId: req.params.nodeId,
    resources: req.body.resources,
    practice: req.body.practice,
  });
  sendSuccess(res, { message: 'Resources updated successfully', data: { roadmap } });
});
