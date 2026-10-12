import { Router } from 'express';
import rateLimit from 'express-rate-limit';

import * as roadmapController from '../controllers/roadmap.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { checkUsageLimit } from '../middleware/usageLimiter.js'; // NEW
import { generateRoadmapSchema, updateNodeStatusSchema } from '../validators/roadmap.validator.js';

const router = Router();

const generateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30, // Relaxed basic DDOS protection
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(authenticate);

// Limit roadmap generations to 2 per day based on their account
router.post('/generate', generateLimiter, checkUsageLimit('roadmaps', 2), validate(generateRoadmapSchema), roadmapController.generate);

router.get('/', roadmapController.list);
router.get('/:id', roadmapController.getRoadmap);
router.patch('/:id/nodes/:nodeId/status', validate(updateNodeStatusSchema), roadmapController.updateNodeStatus);
router.patch('/:id/nodes/:nodeId/resources', roadmapController.updateNodeResources);
router.delete('/:id', roadmapController.removeRoadmap);

export default router;