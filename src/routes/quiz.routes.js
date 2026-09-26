import { Router } from 'express';
import * as quizController from '../controllers/quiz.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { generateQuizSchema, submitQuizSchema } from '../validators/quiz.validator.js';

const router = Router();

router.use(authenticate);

router.post('/generate', validate(generateQuizSchema), quizController.generateQuiz);
router.post('/submit', validate(submitQuizSchema), quizController.submitQuiz);
router.get('/history', quizController.getQuizHistory);

export default router;