import * as careerProfileService from '../services/careerProfile.service.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const generate = asyncHandler(async (req, res) => {
  const profile = await careerProfileService.generateCareerProfile(req.userId);
  sendSuccess(res, {
    message: 'Career profile generated',
    data: { profile },
  });
});

export const getProfile = asyncHandler(async (req, res) => {
  const profile = await careerProfileService.getCareerProfile(req.userId);
  sendSuccess(res, { data: { profile } });
});
