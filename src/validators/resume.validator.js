import { z } from 'zod';

export const resumeUploadSchema = z.object({
  jobDescription: z.string().trim().max(5000).optional().or(z.literal('')),
});
