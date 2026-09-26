import { z } from 'zod';

const workplaceTypeEnum = z.enum(['remote', 'hybrid', 'on-site']);
const employmentTypeEnum = z.enum([
  'full-time',
  'part-time',
  'contract',
  'internship',
]);
const statusEnum = z.enum([
  'bookmarked',
  'applied',
  'screening',
  'interviewing',
  'offered',
  'rejected',
  'withdrawn',
]);

const salarySchema = z
  .object({
    min: z.number().min(0, 'Minimum salary cannot be negative').optional(),
    max: z.number().min(0, 'Maximum salary cannot be negative').optional(),
    currency: z.string().trim().default('USD').optional(),
  })
  .optional();

/**
 * Validator for creating a job application (validates req.body directly)
 */
export const createJobApplicationSchema = z.object({
  company: z
    .string({ required_error: 'Company name is required' })
    .trim()
    .min(1, 'Company name cannot be empty'),
  jobTitle: z
    .string({ required_error: 'Job title is required' })
    .trim()
    .min(1, 'Job title cannot be empty'),
  jobUrl: z.string().trim().optional(),
  location: z.string().trim().optional(),
  workplaceType: workplaceTypeEnum.optional(),
  employmentType: employmentTypeEnum.optional(),
  salary: salarySchema,
  status: statusEnum.optional(),
  appliedDate: z.union([z.string(), z.date()]).optional(),
  notes: z.string().trim().optional(),
});

/**
 * Validator for updating a job application (validates req.body directly)
 */
export const updateJobApplicationSchema = z.object({
  company: z.string().trim().min(1).optional(),
  jobTitle: z.string().trim().min(1).optional(),
  jobUrl: z.string().trim().optional(),
  location: z.string().trim().optional(),
  workplaceType: workplaceTypeEnum.optional(),
  employmentType: employmentTypeEnum.optional(),
  salary: salarySchema,
  status: statusEnum.optional(),
  appliedDate: z.union([z.string(), z.date()]).optional(),
  notes: z.string().trim().optional(),
});

/**
 * Validator for MongoDB ObjectId parameters
 */
export const jobApplicationIdParamSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, 'Invalid MongoDB ObjectId format');