import { Router } from 'express';
import rateLimit from 'express-rate-limit';

import * as roadmapController from '../controllers/roadmap.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { generateRoadmapSchema, updateNodeStatusSchema } from '../validators/roadmap.validator.js';

const router = Router();

const generateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many roadmap generation requests, please try again later' },
});

router.use(authenticate);

router.post('/generate', generateLimiter, validate(generateRoadmapSchema), roadmapController.generate);
router.get('/', roadmapController.list);
router.get('/:id', roadmapController.getRoadmap);
router.patch('/:id/nodes/:nodeId/status', validate(updateNodeStatusSchema), roadmapController.updateNodeStatus);

export default router;
