import { Router } from 'express';
import * as jobApplicationController from '../controllers/jobApplication.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import {
  createJobApplicationSchema,
  updateJobApplicationSchema,
} from '../validators/jobApplication.validator.js';

const router = Router();

// Require authentication for all job application routes
router.use(authenticate);

// Aggregated stats & Recommendations (must come before /:id)
router.get('/stats', jobApplicationController.getApplicationStats);
router.get('/recommendations', jobApplicationController.getRecommendedJobs);

// CRUD endpoints
router.post(
  '/',
  validate(createJobApplicationSchema),
  jobApplicationController.createJobApplication
);

router.get('/', jobApplicationController.getUserJobApplications);

router.get('/:id', jobApplicationController.getJobApplicationById);

router.patch(
  '/:id',
  validate(updateJobApplicationSchema),
  jobApplicationController.updateJobApplication
);

router.delete('/:id', jobApplicationController.deleteJobApplication);

export default router;