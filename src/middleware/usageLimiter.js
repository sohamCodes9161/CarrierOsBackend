import { User } from '../models/User.model.js';

export const checkUsageLimit = (feature, limit) => {
  return async (req, res, next) => {
    try {
      const user = await User.findById(req.userId);
      if (!user) {
        return res.status(401).json({ success: false, message: 'User not found' });
      }

      const today = new Date().toISOString().split('T')[0];

      // If it's a new day, reset all their counters to 0
      // Inside usageLimiter.js (Update this block)
      if (user.usage.date !== today) {
        user.usage = {
          date: today,
          interviews: 0,
          roadmaps: 0,
          portfolioCurations: 0,
          resume_analyses: 0,  // <-- Added
          github_analyses: 0,  // <-- Added
          quizzes: 0,          // <-- Added
          career_profiles: 0,  // <-- Added
          chat_messages: 0,   // <-- Added
        };
      }

      // Check if they hit the limit
      if (user.usage[feature] >= limit) {
        return res.status(429).json({
          success: false,
          message: `Daily limit reached. You can only generate ${limit} ${feature} per day on the student tier. Check back tomorrow!`,
        });
      }

      // Increment their usage and save
      user.usage[feature] += 1;
      await user.save();

      next();
    } catch (error) {
      next(error);
    }
  };
};