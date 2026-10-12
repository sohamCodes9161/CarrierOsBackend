import { Router } from 'express';
import rateLimit from 'express-rate-limit';

import * as careerProfileController from '../controllers/careerProfile.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import {checkUsageLimit } from '../middleware/usageLimiter.js'; // NEW    

const router = Router();

const generateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many career profile generation requests, please try again later' },
});

router.use(authenticate);

router.post('/generate', generateLimiter, checkUsageLimit('career_profiles', 2), careerProfileController.generate);
router.get('/', careerProfileController.getProfile);

export default router;
