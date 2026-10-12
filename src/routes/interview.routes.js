import { Router } from 'express';
import rateLimit from 'express-rate-limit';

import * as interviewController from '../controllers/interview.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { uploadAudioAnswer } from '../middleware/uploadAudio.js';
import { checkUsageLimit } from '../middleware/usageLimiter.js'; // NEW
import { startInterviewSchema, submitAnswerSchema } from '../validators/interview.validator.js';

const router = Router();

// Keep this as DDOS protection, but let the DB handle actual quota logic
const interviewLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 100, 
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(authenticate);
router.use(interviewLimiter);

// ONLY limit the creation of new interviews (2 per day)
router.post('/start', checkUsageLimit('interviews', 2), validate(startInterviewSchema), interviewController.start);

// Do NOT limit answering, so they can finish the interview they started
router.post('/:id/answer', validate(submitAnswerSchema), interviewController.answer);
router.post('/:id/answer/audio', uploadAudioAnswer, interviewController.answerWithAudio);
router.get('/', interviewController.listInterviews);
router.get('/:id', interviewController.getInterview);

export default router;