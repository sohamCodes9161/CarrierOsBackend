import { describe, it, expect } from '@jest/globals';
import {
  updatePortfolioSchema,
  updateSlugSchema,
  projectItemSchema,
  experienceItemSchema,
  educationItemSchema,
  achievementItemSchema,
  reorderSchema,
  improveContentSchema,
} from '../src/validators/portfolio.validator.js';

describe('updatePortfolioSchema', () => {
  it('accepts a partial update with just a headline', () => {
    expect(updatePortfolioSchema.safeParse({ headline: 'Backend Engineer' }).success).toBe(true);
  });

  it('accepts an empty object (no-op update)', () => {
    expect(updatePortfolioSchema.safeParse({}).success).toBe(true);
  });

  it('accepts valid contact fields', () => {
    const result = updatePortfolioSchema.safeParse({
      contact: { email: 'jane@example.com', website: 'https://jane.dev' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid email in contact', () => {
    const result = updatePortfolioSchema.safeParse({ contact: { email: 'not-an-email' } });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid URL in contact.website', () => {
    const result = updatePortfolioSchema.safeParse({ contact: { website: 'not a url' } });
    expect(result.success).toBe(false);
  });

  it('accepts an empty string for optional URL fields (clearing them)', () => {
    const result = updatePortfolioSchema.safeParse({ contact: { website: '' } });
    expect(result.success).toBe(true);
  });
});

describe('updateSlugSchema', () => {
  it('lowercases the slug', () => {
    const result = updateSlugSchema.safeParse({ slug: 'JaneDoe' });
    expect(result.success).toBe(true);
    expect(result.data.slug).toBe('janedoe');
  });

  it('rejects a slug shorter than 3 characters', () => {
    expect(updateSlugSchema.safeParse({ slug: 'ab' }).success).toBe(false);
  });
});

describe('projectItemSchema', () => {
  it('accepts a minimal valid project', () => {
    expect(projectItemSchema.safeParse({ title: 'My Project' }).success).toBe(true);
  });

  it('rejects an empty title', () => {
    expect(projectItemSchema.safeParse({ title: '' }).success).toBe(false);
  });

  it('rejects an invalid githubUrl', () => {
    expect(projectItemSchema.safeParse({ title: 'X', githubUrl: 'not-a-url' }).success).toBe(false);
  });

  it('defaults featured to false and techStack to an empty array', () => {
    const result = projectItemSchema.safeParse({ title: 'X' });
    expect(result.data.featured).toBe(false);
    expect(result.data.techStack).toEqual([]);
  });
});

describe('experienceItemSchema', () => {
  it('accepts endDate as null (present/ongoing)', () => {
    const result = experienceItemSchema.safeParse({ company: 'Acme', role: 'Engineer', endDate: null });
    expect(result.success).toBe(true);
  });

  it('requires company and role', () => {
    expect(experienceItemSchema.safeParse({ company: 'Acme' }).success).toBe(false);
  });
});

describe('educationItemSchema', () => {
  it('requires institution and degree', () => {
    expect(educationItemSchema.safeParse({ institution: 'MIT' }).success).toBe(false);
    expect(educationItemSchema.safeParse({ institution: 'MIT', degree: 'BS' }).success).toBe(true);
  });
});

describe('achievementItemSchema', () => {
  it('requires a title', () => {
    expect(achievementItemSchema.safeParse({}).success).toBe(false);
    expect(achievementItemSchema.safeParse({ title: 'Hackathon Winner' }).success).toBe(true);
  });
});

describe('reorderSchema', () => {
  it('accepts a non-empty list of ids', () => {
    expect(reorderSchema.safeParse({ orderedIds: ['a', 'b'] }).success).toBe(true);
  });

  it('rejects an empty list', () => {
    expect(reorderSchema.safeParse({ orderedIds: [] }).success).toBe(false);
  });
});

describe('improveContentSchema', () => {
  it('accepts a valid section and text', () => {
    expect(improveContentSchema.safeParse({ section: 'bio', text: 'I am a developer.' }).success).toBe(true);
  });

  it('rejects an invalid section', () => {
    expect(improveContentSchema.safeParse({ section: 'invalid', text: 'x' }).success).toBe(false);
  });

  it('rejects empty text', () => {
    expect(improveContentSchema.safeParse({ section: 'bio', text: '' }).success).toBe(false);
  });
});
