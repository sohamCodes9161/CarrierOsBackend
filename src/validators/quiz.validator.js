export const generateQuizSchema = z.object({
  topic: z
    .string({ required_error: 'Topic is required' })
    .trim()
    .min(1, 'Topic cannot be empty'),
  roadmapId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid Roadmap ObjectId')
    .nullable()
    .optional()
    .or(z.literal(''))
    .transform((val) => (val === '' ? undefined : val)),
  nodeId: z
    .string()
    .trim()
    .nullable()
    .optional()
    .or(z.literal(''))
    .transform((val) => (val === '' ? undefined : val)),
  questionCount: z
    .number()
    .int()
    .min(3, 'Minimum 3 questions')
    .max(10, 'Maximum 10 questions')
    .default(5)
    .optional(),
});