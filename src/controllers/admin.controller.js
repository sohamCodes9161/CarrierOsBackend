import { User } from '../models/User.model.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getDashboardStats = asyncHandler(async (req, res) => {
  const totalUsers = await User.countDocuments();

  const usageStats = await User.aggregate([
    {
      $group: {
        _id: null,
        totalInterviews: { $sum: '$usage.interviews' },
        totalRoadmaps: { $sum: '$usage.roadmaps' },
        totalResumes: { $sum: '$usage.resume_analyses' },
        totalGithubs: { $sum: '$usage.github_analyses' },
        totalQuizzes: { $sum: '$usage.quizzes' },
        totalProfiles: { $sum: '$usage.career_profiles' },
      },
    },
  ]);

  const stats =
    usageStats.length > 0
      ? usageStats[0]
      : {
          totalInterviews: 0,
          totalRoadmaps: 0,
          totalResumes: 0,
          totalGithubs: 0,
          totalQuizzes: 0,
          totalProfiles: 0,
        };

  delete stats._id;

  sendSuccess(res, { data: { totalUsers, stats } });
});

export const listUsers = asyncHandler(async (req, res) => {
  const today = new Date().toISOString().split('T')[0];

  const rawUsers = await User.find()
    .select('name email role usage createdAt')
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  // If a user's usage record is from an earlier date, reflect 0 for "Today's Usage"
  const users = rawUsers.map((u) => {
    const isToday = u.usage?.date === today;
    return {
      ...u,
      usage: isToday
        ? u.usage
        : {
            date: today,
            interviews: 0,
            roadmaps: 0,
            portfolioCurations: 0,
            resume_analyses: 0,
            github_analyses: 0,
            quizzes: 0,
            career_profiles: 0,
            chat_messages: 0,
          },
    };
  });

  sendSuccess(res, { data: { users } });
});

export const resetUserQuota = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const today = new Date().toISOString().split('T')[0];

  const user = await User.findByIdAndUpdate(
    id,
    {
      $set: {
        usage: {
          date: today,
          interviews: 0,
          roadmaps: 0,
          portfolioCurations: 0,
          resume_analyses: 0,
          github_analyses: 0,
          quizzes: 0,
          career_profiles: 0,
          chat_messages: 0,
        },
      },
    },
    { new: true, runValidators: true }
  ).select('name email role usage createdAt');

  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  sendSuccess(res, { message: 'User quota reset successfully', data: { user } });
});