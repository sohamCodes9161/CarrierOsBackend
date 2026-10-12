import { Router } from 'express';
import * as quizController from '../controllers/quiz.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { generateQuizSchema, submitQuizSchema } from '../validators/quiz.validator.js';
import { checkUsageLimit } from '../middleware/usageLimiter.js'; // NEW     
const router = Router();

router.use(authenticate);

router.post('/generate', checkUsageLimit('quizzes', 3), validate(generateQuizSchema), quizController.generateQuiz);
router.post('/submit', validate(submitQuizSchema), quizController.submitQuiz);
router.get('/history', quizController.getQuizHistory);

export default router;