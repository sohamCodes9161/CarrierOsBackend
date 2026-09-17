import { z } from 'zod';

export const startInterviewSchema = z.object({
  role: z.string().trim().min(2, 'Role must be at least 2 characters').max(100),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  interviewType: z.enum(['technical', 'behavioral', 'mixed', 'dsa']),
  targetSkills: z.array(z.string().trim().min(1)).max(15).optional().default([]),
  totalQuestions: z.number().int().min(1).max(20).optional().default(5),
  voiceEnabled: z.boolean().optional().default(false),
});

export const submitAnswerSchema = z.object({
  answerText: z
    .string()
    .trim()
    .min(1, 'Answer cannot be empty')
    .max(5000, 'Answer is too long (max 5000 characters)'),
});
