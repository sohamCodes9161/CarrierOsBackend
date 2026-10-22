import { Router } from 'express';
import rateLimit from 'express-rate-limit';

import * as interviewController from '../controllers/interview.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { uploadAudioAnswer } from '../middleware/uploadAudio.js';
import { checkUsageLimit } from '../middleware/usageLimiter.js';
import { startInterviewSchema, submitAnswerSchema } from '../validators/interview.validator.js';

const router = Router();

const interviewLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 100, 
  standardHeaders: true,
  legacyHeaders: false,
});

// NEW: Limiter specifically for the AI validation step (5 per hour)
const validationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, 
  message: { success: false, message: 'Too many interview attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(authenticate);
router.use(interviewLimiter);

// THE NEW PIPELINE:
// 1. validationLimiter: Blocks spam >5/hr
// 2. validate: Checks if JSON body has required fields
// 3. validateInputAI: AI checks for gibberish (throws error if fake, NO quota used)
// 4. checkUsageLimit: Deducts 1 from daily limit ONLY IF AI approved it
// 5. start: Generates the interview
router.post(
  '/start', 
  validationLimiter, 
  validate(startInterviewSchema), 
  interviewController.validateInputAI, 
  checkUsageLimit('interviews', 2), 
  interviewController.start
);

router.post('/:id/answer', validate(submitAnswerSchema), interviewController.answer);
router.post('/:id/answer/audio', uploadAudioAnswer, interviewController.answerWithAudio);
router.get('/', interviewController.listInterviews);
router.get('/:id', interviewController.getInterview);

export default router;