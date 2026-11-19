import { User } from '../models/User.model.js';

function createFreshUsage(today) {
  return {
    date: today,
    interviews: 0,
    roadmaps: 0,
    portfolioCurations: 0,
    resume_analyses: 0,
    github_analyses: 0,
    quizzes: 0,
    career_profiles: 0,
    chat_messages: 0,
  };
}

export const checkUsageLimit = (feature, limit) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?._id || req.user?.id || req.userId;
      const user = await User.findById(userId);
      if (!user) {
        return res.status(401).json({ success: false, message: 'User not found' });
      }

      const today = new Date().toISOString().split('T')[0];

      // Reset daily counters if it's a new UTC day
      if (!user.usage || user.usage.date !== today) {
        user.usage = createFreshUsage(today);
      }

      const isAdmin = user.role === 'admin';

      // Admins have unlimited quota; regular users are capped per day
      if (!isAdmin && (user.usage[feature] || 0) >= limit) {
        return res.status(429).json({
          success: false,
          message: `Daily limit reached. You can only generate ${limit} ${feature.replace('_', ' ')} per day on the student tier. Check back tomorrow!`,
        });
      }

      user.usage[feature] = (user.usage[feature] || 0) + 1;
      await user.save();

      next();
    } catch (error) {
      next(error);
    }
  };
};