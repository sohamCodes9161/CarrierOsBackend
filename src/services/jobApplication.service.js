import mongoose from 'mongoose';
import JobApplication from '../models/JobApplication.model.js';
import { CareerProfile } from '../models/CareerProfile.model.js';
import { NotFoundError } from '../errors/AppError.js';

/**
 * Create a new job application entry (Manual or Quick-Apply from Recommendations)
 */
export const createJobApplication = async (userId, data) => {
  const jobApplication = await JobApplication.create({
    ...data,
    user: userId,
  });
  return jobApplication;
};

/**
 * Get all job applications for a user with pagination, filtering, and search
 */
export const getUserJobApplications = async (userId, query) => {
  const {
    status,
    search,
    page = 1,
    limit = 10,
    sortBy = 'appliedDate',
    sortOrder = 'desc',
  } = query;

  const filter = { user: userId };

  if (status) {
    filter.status = status;
  }

  if (search) {
    filter.$or = [
      { company: { $regex: search,$options: 'i' } },
      { jobTitle: { $regex: search,$options: 'i' } },
      { location: { $regex: search,$options: 'i' } },
    ];
  }

  const skip = (page - 1) * limit;
  const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

  const [applications, total] = await Promise.all([
    JobApplication.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    JobApplication.countDocuments(filter),
  ]);

  return {
    applications,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * Get a single job application by ID (scoped to user)
 */
export const getJobApplicationById = async (userId, applicationId) => {
  const application = await JobApplication.findOne({
    _id: applicationId,
    user: userId,
  });

  if (!application) {
    throw new NotFoundError('Job application not found');
  }

  return application;
};

/**
 * Update an existing job application
 */
export const updateJobApplication = async (
  userId,
  applicationId,
  updateData
) => {
  const application = await JobApplication.findOneAndUpdate(
    { _id: applicationId, user: userId },
    { $set: updateData },
    { returnDocument: 'after', runValidators: true }
  );

  if (!application) {
    throw new NotFoundError('Job application not found');
  }

  return application;
};

/**
 * Delete a job application
 */
export const deleteJobApplication = async (userId, applicationId) => {
  const application = await JobApplication.findOneAndDelete({
    _id: applicationId,
    user: userId,
  });

  if (!application) {
    throw new NotFoundError('Job application not found');
  }

  return { message: 'Job application deleted successfully' };
};

/**
 * Get analytics summary for user's job application pipeline
 */
export const getApplicationStats = async (userId) => {
  const userObjectId =
    typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

  const stats = await JobApplication.aggregate([
    { $match: { user: userObjectId } },
    { $group: { _id: '$status', count: {$sum: 1 } } },
  ]);

  const defaultStats = {
    bookmarked: 0,
    applied: 0,
    screening: 0,
    interviewing: 0,
    offered: 0,
    rejected: 0,
    withdrawn: 0,
    total: 0,
  };

  stats.forEach((item) => {
    if (Object.prototype.hasOwnProperty.call(defaultStats, item._id)) {
      defaultStats[item._id] = item.count;
      defaultStats.total += item.count;
    }
  });

  return defaultStats;
};

/**
 * Fetch personalized job recommendations based on user's profile
 */
export const getRecommendedJobs = async (userId, searchQuery) => {
  const profile = await CareerProfile.findOne({ user: userId }).lean();

  const queryRole =
    searchQuery || profile?.targetRole || 'Software Engineer';
  const userSkills = profile?.skills || [];

  const mockRecommendations = [
    {
      id: 'ext_job_101',
      company: 'TechCorp Solutions',
      jobTitle: `${queryRole}`,
      location: 'Remote',
      workplaceType: 'remote',
      employmentType: 'full-time',
      salary: { min: 80000, max: 110000, currency: 'USD' },
      jobUrl: 'https://example.com/jobs/techcorp-engineer',
      matchScore: 92,
    },
    {
      id: 'ext_job_102',
      company: 'InnoLabs Inc.',
      jobTitle: `Junior ${queryRole}`,
      location: 'Hybrid - New York, NY',
      workplaceType: 'hybrid',
      employmentType: 'full-time',
      salary: { min: 75000, max: 95000, currency: 'USD' },
      jobUrl: 'https://example.com/jobs/innolabs-junior',
      matchScore: 88,
    },
    {
      id: 'ext_job_103',
      company: 'CloudScale Systems',
      jobTitle: `Full Stack Developer`,
      location: 'On-site - San Francisco, CA',
      workplaceType: 'on-site',
      employmentType: 'full-time',
      salary: { min: 90000, max: 130000, currency: 'USD' },
      jobUrl: 'https://example.com/jobs/cloudscale-developer',
      matchScore: 82,
    },
  ];

  return {
    queryRole,
    matchedSkills: userSkills,
    recommendations: mockRecommendations,
  };
};