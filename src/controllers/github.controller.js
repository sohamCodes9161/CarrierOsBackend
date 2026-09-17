import * as githubService from '../services/github.service.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const analyzeProfile = asyncHandler(async (req, res) => {
  const analysis = await githubService.analyzeGithubProfile({
    userId: req.userId,
    username: req.body.username,
  });

  sendSuccess(res, {
    statusCode: 201,
    message: 'GitHub profile analyzed successfully',
    data: { analysis },
  });
});

export const getAnalysis = asyncHandler(async (req, res) => {
  const analysis = await githubService.getGithubAnalysisById({
    analysisId: req.params.id,
    userId: req.userId,
  });
  sendSuccess(res, { data: { analysis } });
});

export const listAnalyses = asyncHandler(async (req, res) => {
  const analyses = await githubService.listGithubAnalysesForUser(req.userId);
  sendSuccess(res, { data: { analyses } });
});
