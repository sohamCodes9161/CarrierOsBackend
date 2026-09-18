import { Router } from 'express';
import rateLimit from 'express-rate-limit';

import * as portfolioController from '../controllers/portfolio.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import {
  updatePortfolioSchema,
  updateSlugSchema,
  projectItemSchema,
  projectItemUpdateSchema,
  experienceItemSchema,
  experienceItemUpdateSchema,
  educationItemSchema,
  educationItemUpdateSchema,
  achievementItemSchema,
  achievementItemUpdateSchema,
  reorderSchema,
  improveContentSchema,
} from '../validators/portfolio.validator.js';

const router = Router();

const publicLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many AI content requests, please try again later' },
});

// --- Public routes (no auth) - registered before the authenticate() gate below ---
router.get('/public/:slug', publicLimiter, portfolioController.getPublicPortfolio);
router.get('/slug-availability/:slug', publicLimiter, portfolioController.checkSlugAvailability);

// --- Everything below requires authentication ---
router.use(authenticate);

router.get('/', portfolioController.getOwnPortfolio);
router.patch('/', validate(updatePortfolioSchema), portfolioController.updatePortfolio);
router.post('/quick-start', portfolioController.quickStart);

router.get('/publish-readiness', portfolioController.getPublishReadiness);
router.post('/publish', portfolioController.publish);
router.post('/unpublish', portfolioController.unpublish);

router.patch('/slug', validate(updateSlugSchema), portfolioController.updateSlug);

router.post('/improve-content', aiLimiter, validate(improveContentSchema), portfolioController.improveContent);

router.post('/projects', validate(projectItemSchema), portfolioController.projects.add);
router.patch('/projects/:itemId', validate(projectItemUpdateSchema), portfolioController.projects.update);
router.delete('/projects/:itemId', portfolioController.projects.remove);
router.patch('/projects/reorder', validate(reorderSchema), portfolioController.projects.reorder);

router.post('/experience', validate(experienceItemSchema), portfolioController.experience.add);
router.patch('/experience/:itemId', validate(experienceItemUpdateSchema), portfolioController.experience.update);
router.delete('/experience/:itemId', portfolioController.experience.remove);
router.patch('/experience/reorder', validate(reorderSchema), portfolioController.experience.reorder);

router.post('/education', validate(educationItemSchema), portfolioController.education.add);
router.patch('/education/:itemId', validate(educationItemUpdateSchema), portfolioController.education.update);
router.delete('/education/:itemId', portfolioController.education.remove);
router.patch('/education/reorder', validate(reorderSchema), portfolioController.education.reorder);

router.post('/achievements', validate(achievementItemSchema), portfolioController.achievements.add);
router.patch('/achievements/:itemId', validate(achievementItemUpdateSchema), portfolioController.achievements.update);
router.delete('/achievements/:itemId', portfolioController.achievements.remove);
router.patch('/achievements/reorder', validate(reorderSchema), portfolioController.achievements.reorder);

export default router;
