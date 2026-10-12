import { User } from '../models/User.model.js';

export const isAdmin = async (req, res, next) => {
  try {
    // req.userId comes from your existing `authenticate` middleware
    const user = await User.findById(req.userId);
    
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Admin privileges required.' 
      });
    }
    
    next();
  } catch (error) {
    next(error);
  }
};