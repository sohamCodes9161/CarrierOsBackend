import * as jobSearchService from '../services/jobSearch.service.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const createJobPosting = asyncHandler(async (req, res) => {
  const posting = await jobSearchService.createJobPosting(req.userId, req.body);

  sendSuccess(res, {
    statusCode: 201,
    message: 'Job posting created successfully',
    data: posting,
  });
});

export const searchAndScoreJobs = asyncHandler(async (req, res) => {
  const result = await jobSearchService.searchAndScoreJobs(req.userId, req.query);

  sendSuccess(res, {
    message: 'Job postings retrieved and scored successfully',
    data: result,
  });
});

export const getJobPostingById = asyncHandler(async (req, res) => {
  const posting = await jobSearchService.getJobPostingById(req.userId, req.params.id);

  sendSuccess(res, {
    message: 'Job posting details retrieved successfully',
    data: posting,
  });
});

export const convertPostingToApplication = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const application = await jobSearchService.convertPostingToApplication(
    req.userId,
    req.params.id,
    status
  );

  sendSuccess(res, {
    statusCode: 201,
    message: 'Job posting converted to tracked application successfully',
    data: application,
  });
});