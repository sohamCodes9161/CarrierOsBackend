import { Router } from 'express';
import rateLimit from 'express-rate-limit';

import * as resumeController from '../controllers/resume.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { uploadResume } from '../middleware/upload.js';
import { validate } from '../middleware/validate.js';
import { resumeUploadSchema } from '../validators/resume.validator.js';

const router = Router();

// AI analysis is expensive - stricter limiter than general API routes
const analyzeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many analysis requests, please try again later' },
});

router.use(authenticate); // every resume route requires a logged-in user

router.post(
  '/analyze',
  analyzeLimiter,
  uploadResume,
  validate(resumeUploadSchema),
  resumeController.analyzeResume
);
router.get('/analyses', resumeController.listAnalyses);
router.get('/analyses/:id', resumeController.getAnalysis);
router.delete('/:id', resumeController.removeResume);

export default router;
