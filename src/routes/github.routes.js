import { Router } from 'express';
import rateLimit from 'express-rate-limit';

import * as githubController from '../controllers/github.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { githubAnalyzeSchema } from '../validators/github.validator.js';

const router = Router();

const analyzeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many analysis requests, please try again later' },
});

router.use(authenticate);

router.post('/analyze', analyzeLimiter, validate(githubAnalyzeSchema), githubController.analyzeProfile);
router.get('/analyses', githubController.listAnalyses);
router.get('/analyses/:id', githubController.getAnalysis);

export default router;
