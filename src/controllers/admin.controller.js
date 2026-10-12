import { User } from '../models/User.model.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getDashboardStats = asyncHandler(async (req, res) => {
  const totalUsers = await User.countDocuments();
  
  // Aggregate total usage across the entire platform
  const usageStats = await User.aggregate([
    {
      $group: {
        _id: null,
        totalInterviews: { $sum: '$usage.interviews' },
        totalRoadmaps: { $sum: '$usage.roadmaps' },
        totalResumes: { $sum: '$usage.resume_analyses' },
        totalGithubs: { $sum: '$usage.github_analyses' },
        totalQuizzes: { $sum: '$usage.quizzes' },
        totalProfiles: { $sum: '$usage.career_profiles' }
      }
    }
  ]);

  const stats = usageStats.length > 0 ? usageStats[0] : {
    totalInterviews: 0,
    totalRoadmaps: 0,
    totalResumes: 0,
    totalGithubs: 0,
    totalQuizzes: 0,
    totalProfiles: 0
  };

  delete stats._id;

  sendSuccess(res, { data: { totalUsers, stats } });
});

export const listUsers = asyncHandler(async (req, res) => {
  // Fetch latest 100 users with their usage data
  const users = await User.find()
    .select('name email role usage createdAt')
    .sort({ createdAt: -1 })
    .limit(100);
    
  sendSuccess(res, { data: { users } });
});

export const resetUserQuota = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = await User.findById(id);
  
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  const today = new Date().toISOString().split('T')[0];
  user.usage = {
    date: today,
    interviews: 0,
    roadmaps: 0,
    portfolioCurations: 0,
    resume_analyses: 0,
    github_analyses: 0,
    quizzes: 0,
    career_profiles: 0,
  };

  await user.save();
  sendSuccess(res, { message: 'User quota reset successfully', data: { user } });
});