import { z } from 'zod';

export const generateRoadmapSchema = z.object({
  targetRole: z.string().trim().min(2, 'Target role must be at least 2 characters').max(100),
  targetSkills: z.array(z.string().trim().min(1)).max(30).optional().default([]),
});

export const updateNodeStatusSchema = z.object({
  status: z.enum(['not_started', 'in_progress', 'completed', 'skipped']),
});
