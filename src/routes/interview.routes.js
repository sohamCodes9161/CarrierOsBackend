import { Router } from 'express';
import rateLimit from 'express-rate-limit';

import * as interviewController from '../controllers/interview.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { uploadAudioAnswer } from '../middleware/uploadAudio.js';
import { startInterviewSchema, submitAnswerSchema } from '../validators/interview.validator.js';

const router = Router();

const interviewLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30, // higher than resume/github since each interview involves multiple AI calls across its lifetime
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many interview requests, please try again later' },
});

router.use(authenticate);
router.use(interviewLimiter);

router.post('/start', validate(startInterviewSchema), interviewController.start);
router.post('/:id/answer', validate(submitAnswerSchema), interviewController.answer);
router.post('/:id/answer/audio', uploadAudioAnswer, interviewController.answerWithAudio);
router.get('/', interviewController.listInterviews);
router.get('/:id', interviewController.getInterview);

export default router;
