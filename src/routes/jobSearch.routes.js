import { Router } from 'express';
import * as jobSearchController from '../controllers/jobSearch.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { createJobPostingSchema } from '../validators/jobSearch.validator.js';

const router = Router();

// Protect all job search routes
router.use(authenticate);

// List/Search scored jobs & Create custom posting
router.get('/', jobSearchController.searchAndScoreJobs);

router.post(
  '/',
  validate(createJobPostingSchema),
  jobSearchController.createJobPosting
);

// Get specific job details with match score
router.get('/:id', jobSearchController.getJobPostingById);

// Convert job posting into tracked JobApplication
router.post('/:id/convert', jobSearchController.convertPostingToApplication);

export default router;