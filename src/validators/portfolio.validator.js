import { z } from 'zod';

const urlOrEmpty = z.string().trim().url().optional().or(z.literal(''));
const optionalStr = z.string().trim().max(2000).optional();

export const updatePortfolioSchema = z.object({
  headline: z.string().trim().max(150).optional(),
  bio: z.string().trim().max(2000).optional(),
  contact: z
    .object({
      email: z.string().trim().email().optional().or(z.literal('')),
      phone: z.string().trim().max(30).optional(),
      location: z.string().trim().max(100).optional(),
      website: urlOrEmpty,
      linkedin: urlOrEmpty,
      github: urlOrEmpty,
      twitter: urlOrEmpty,
    })
    .partial()
    .optional(),
  skills: z.array(z.string().trim().min(1)).max(50).optional(),
  templateId: z.string().trim().max(50).optional(),
  themeColor: z.string().trim().max(30).optional(),
});

export const updateSlugSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'Slug must be at least 3 characters')
    .max(40, 'Slug must be at most 40 characters'),
});

export const projectItemSchema = z.object({
  title: z.string().trim().min(1).max(150),
  description: optionalStr,
  techStack: z.array(z.string().trim().min(1)).max(20).optional().default([]),
  githubUrl: urlOrEmpty,
  liveUrl: urlOrEmpty,
  imageUrl: urlOrEmpty,
  featured: z.boolean().optional().default(false),
});

export const experienceItemSchema = z.object({
  company: z.string().trim().min(1).max(150),
  role: z.string().trim().min(1).max(150),
  startDate: z.string().trim().max(30).optional(),
  endDate: z.string().trim().max(30).nullable().optional(),
  description: optionalStr,
});

export const educationItemSchema = z.object({
  institution: z.string().trim().min(1).max(150),
  degree: z.string().trim().min(1).max(150),
  fieldOfStudy: z.string().trim().max(150).optional(),
  startDate: z.string().trim().max(30).optional(),
  endDate: z.string().trim().max(30).optional(),
});

export const achievementItemSchema = z.object({
  title: z.string().trim().min(1).max(150),
  description: optionalStr,
  date: z.string().trim().max(30).optional(),
});

// Partial versions for PATCH (update) - same shape, nothing required
export const projectItemUpdateSchema = projectItemSchema.partial();
export const experienceItemUpdateSchema = experienceItemSchema.partial();
export const educationItemUpdateSchema = educationItemSchema.partial();
export const achievementItemUpdateSchema = achievementItemSchema.partial();

export const reorderSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1),
});

export const improveContentSchema = z.object({
  section: z.enum(['headline', 'bio', 'project', 'experience', 'achievement']),
  text: z.string().trim().min(1, 'Text is required').max(2000),
});
