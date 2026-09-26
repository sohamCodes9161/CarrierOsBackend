import * as jobApplicationService from '../services/jobApplication.service.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const createJobApplication = asyncHandler(async (req, res) => {
  const application = await jobApplicationService.createJobApplication(
    req.userId,
    req.body
  );

  sendSuccess(res, {
    statusCode: 201,
    message: 'Job application created successfully',
    data: application,
  });
});

export const getUserJobApplications = asyncHandler(async (req, res) => {
  const result = await jobApplicationService.getUserJobApplications(
    req.userId,
    req.query
  );

  sendSuccess(res, {
    message: 'Job applications retrieved successfully',
    data: result,
  });
});

export const getApplicationStats = asyncHandler(async (req, res) => {
  const stats = await jobApplicationService.getApplicationStats(req.userId);

  sendSuccess(res, {
    message: 'Job application stats retrieved successfully',
    data: stats,
  });
});

export const getRecommendedJobs = asyncHandler(async (req, res) => {
  const recommendations = await jobApplicationService.getRecommendedJobs(
    req.userId,
    req.query.search
  );

  sendSuccess(res, {
    message: 'Job recommendations retrieved successfully',
    data: recommendations,
  });
});

export const getJobApplicationById = asyncHandler(async (req, res) => {
  const application = await jobApplicationService.getJobApplicationById(
    req.userId,
    req.params.id
  );

  sendSuccess(res, {
    message: 'Job application details retrieved successfully',
    data: application,
  });
});

export const updateJobApplication = asyncHandler(async (req, res) => {
  const application = await jobApplicationService.updateJobApplication(
    req.userId,
    req.params.id,
    req.body
  );

  sendSuccess(res, {
    message: 'Job application updated successfully',
    data: application,
  });
});

export const deleteJobApplication = asyncHandler(async (req, res) => {
  const result = await jobApplicationService.deleteJobApplication(
    req.userId,
    req.params.id
  );

  sendSuccess(res, {
    message: result.message,
  });
});