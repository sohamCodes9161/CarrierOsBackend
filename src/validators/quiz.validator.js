import { z } from 'zod';

/**
 * Schema for generating a new adaptive micro-quiz
 */
export const generateQuizSchema = z.object({
  topic: z
    .string({ required_error: 'Topic is required' })
    .trim()
    .min(1, 'Topic cannot be empty'),
  roadmapId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid Roadmap ObjectId')
    .optional(),
  nodeId: z.string().trim().optional(),
  questionCount: z
    .number()
    .int()
    .min(3, 'Minimum 3 questions')
    .max(10, 'Maximum 10 questions')
    .default(5)
    .optional(),
});

/**
 * Schema for submitting an active quiz attempt
 */
export const submitQuizSchema = z.object({
  quizId: z
    .string({ required_error: 'Quiz ID is required' })
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid Quiz ObjectId'),
  totalTimeSpentSeconds: z
    .number({ required_error: 'Total time spent is required' })
    .min(0, 'Time spent cannot be negative'),
  answers: z
    .array(
      z.object({
        questionId: z
          .string({ required_error: 'Question ID is required' })
          .regex(/^[0-9a-fA-F]{24}$/, 'Invalid Question ObjectId'),
        selectedOptionIndex: z
          .number()
          .int()
          .min(0)
          .max(3, 'Option index must be between 0 and 3'),
        timeSpentSeconds: z.number().min(0).default(0),
      })
    )
    .min(1, 'At least one answer must be submitted'),
});