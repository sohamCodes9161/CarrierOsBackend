import { z } from 'zod';

const workplaceTypeEnum = z.enum(['remote', 'hybrid', 'on-site']);
const employmentTypeEnum = z.enum([
  'full-time',
  'part-time',
  'contract',
  'internship',
]);

const salarySchema = z
  .object({
    min: z.number().min(0, 'Minimum salary cannot be negative').optional(),
    max: z.number().min(0, 'Maximum salary cannot be negative').optional(),
    currency: z.string().trim().default('USD').optional(),
  })
  .optional();

/**
 * Validator for creating a custom job posting
 */
export const createJobPostingSchema = z.object({
  company: z
    .string({ required_error: 'Company name is required' })
    .trim()
    .min(1, 'Company name cannot be empty'),
  title: z
    .string({ required_error: 'Job title is required' })
    .trim()
    .min(1, 'Job title cannot be empty'),
  description: z
    .string({ required_error: 'Job description is required' })
    .trim()
    .min(1, 'Job description cannot be empty'),
  requiredSkills: z
    .array(z.string().trim())
    .min(1, 'At least one required skill must be specified'),
  location: z.string().trim().optional(),
  workplaceType: workplaceTypeEnum.optional(),
  employmentType: employmentTypeEnum.optional(),
  salary: salarySchema,
  jobUrl: z.string().trim().optional(),
});

/**
 * Validator for on-the-fly match scoring without saving
 */
export const scoreJobPostingSchema = z.object({
  targetSkills: z
    .array(z.string().trim())
    .min(1, 'At least one target skill is required to calculate match score'),
});