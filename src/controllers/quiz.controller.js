import * as quizService from '../services/quiz.service.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const generateQuiz = asyncHandler(async (req, res) => {
  const quiz = await quizService.generateQuiz(req.userId, req.body);

  sendSuccess(res, {
    statusCode: 201,
    message: 'Adaptive micro-quiz generated successfully',
    data: quiz,
  });
});

export const submitQuiz = asyncHandler(async (req, res) => {
  const attempt = await quizService.submitQuiz(req.userId, req.body);

  sendSuccess(res, {
    statusCode: 201,
    message: 'Quiz attempt submitted and graded successfully',
    data: attempt,
  });
});

export const getQuizHistory = asyncHandler(async (req, res) => {
  const history = await quizService.getQuizHistory(req.userId, req.query.topic);

  sendSuccess(res, {
    message: 'Quiz history retrieved successfully',
    data: history,
  });
});