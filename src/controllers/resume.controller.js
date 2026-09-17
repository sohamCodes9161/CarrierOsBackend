import * as resumeService from '../services/resume.service.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { BadRequestError } from '../errors/AppError.js';

export const analyzeResume = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new BadRequestError('No resume file provided. Upload it under the "resume" field.');
  }

  const { resume, analysis } = await resumeService.uploadAndAnalyzeResume({
    userId: req.userId,
    file: req.file,
    jobDescription: req.body.jobDescription || null,
  });

  sendSuccess(res, {
    statusCode: 201,
    message: 'Resume analyzed successfully',
    data: { resume, analysis },
  });
});

export const getAnalysis = asyncHandler(async (req, res) => {
  const analysis = await resumeService.getResumeAnalysisById({
    analysisId: req.params.id,
    userId: req.userId,
  });
  sendSuccess(res, { data: { analysis } });
});

export const listAnalyses = asyncHandler(async (req, res) => {
  const analyses = await resumeService.listResumeAnalysesForUser(req.userId);
  sendSuccess(res, { data: { analyses } });
});

export const removeResume = asyncHandler(async (req, res) => {
  await resumeService.deleteResume({ resumeId: req.params.id, userId: req.userId });
  sendSuccess(res, { message: 'Resume deleted successfully' });
});
